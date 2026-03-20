import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { NodejsFunction, OutputFormat, BundlingOptions } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as path from "path";

interface RealEstateWorkerStackProps extends cdk.StackProps {
  /** Name of a SecretsManager secret holding DATABASE_URL */
  dbSecretName: string;
  environment: "staging" | "production";
}

export class RealEstateWorkerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RealEstateWorkerStackProps) {
    super(scope, id, props);

    // -----------------------------------------------------------------------
    // Shared configuration
    // -----------------------------------------------------------------------
    const dbSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "DbSecret",
      props.dbSecretName
    );

    // Resolve from repo root so this path is stable regardless of where
    // this file sits within infra/
    // __dirname = infra/cdk/lib/stacks → 4 levels up to repo root
    const repoRoot = path.resolve(__dirname, "../../../..");
    const workersRoot = path.join(repoRoot, "workers/src");

    // Shared bundling config applied to every NodejsFunction in this stack.
    // esbuild runs at cdk synth time — no manual tsc build step needed.
    const sharedBundling: BundlingOptions = {
      minify: true,
      sourceMap: true,
      // Bundle all dependencies into a single file — no node_modules needed
      // in the Lambda zip, which shrinks cold-start size significantly.
      externalModules: [],
      // esbuild target matches the Lambda runtime
      target: "node20",
      format: OutputFormat.CJS,
    };

    const sharedFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      bundling: sharedBundling,
      environment: {
        NODE_ENV: props.environment,
      },
    };

    // -----------------------------------------------------------------------
    // Dead-letter queues (one per worker, for independent DLQ monitoring)
    // -----------------------------------------------------------------------
    const emailDlq = new sqs.Queue(this, "EmailWorkerDlq", {
      queueName: `real-estate-email-dlq-${props.environment}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    const aiDlq = new sqs.Queue(this, "AiWorkerDlq", {
      queueName: `real-estate-ai-dlq-${props.environment}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // -----------------------------------------------------------------------
    // SQS queues (source queues)
    // -----------------------------------------------------------------------
    const emailQueue = new sqs.Queue(this, "EmailQueue", {
      queueName: `real-estate-email-${props.environment}`,
      visibilityTimeout: cdk.Duration.seconds(90), // must be >= Lambda timeout * 6
      deadLetterQueue: { queue: emailDlq, maxReceiveCount: 3 },
    });

    const aiQueue = new sqs.Queue(this, "AiQueue", {
      queueName: `real-estate-ai-${props.environment}`,
      visibilityTimeout: cdk.Duration.seconds(90),
      deadLetterQueue: { queue: aiDlq, maxReceiveCount: 3 },
    });

    // -----------------------------------------------------------------------
    // EmailWorker Lambda
    // Points directly at the .ts source file — esbuild handles transpilation
    // -----------------------------------------------------------------------
    const emailWorker = new NodejsFunction(this, "EmailWorker", {
      ...sharedFunctionProps,
      functionName: `real-estate-email-worker-${props.environment}`,
      // entry is the .ts file; esbuild resolves all imports from here
      entry: path.join(workersRoot, "emailProcessor.ts"),
      handler: "handler",
      description: "Sends deal-created confirmation emails via EmailService",
    });

    dbSecret.grantRead(emailWorker);
    emailWorker.addEnvironment(
      "DATABASE_URL",
      `{{resolve:secretsmanager:${props.dbSecretName}:SecretString:url}}`
    );

    emailWorker.addEventSource(
      new lambdaEventSources.SqsEventSource(emailQueue, {
        batchSize: 10,
        maxBatchingWindow: cdk.Duration.seconds(5),
        reportBatchItemFailures: true,
      })
    );

    // -----------------------------------------------------------------------
    // AIWorker Lambda
    // -----------------------------------------------------------------------
    const aiWorker = new NodejsFunction(this, "AiWorker", {
      ...sharedFunctionProps,
      functionName: `real-estate-ai-worker-${props.environment}`,
      entry: path.join(workersRoot, "aiWorker.ts"),
      handler: "handler",
      description: "Generates AI deal summaries and persists them as activities",
      // AI calls can be slower — give it more time and memory
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    });

    dbSecret.grantRead(aiWorker);
    aiWorker.addEnvironment(
      "DATABASE_URL",
      `{{resolve:secretsmanager:${props.dbSecretName}:SecretString:url}}`
    );

    aiWorker.addEventSource(
      new lambdaEventSources.SqsEventSource(aiQueue, {
        batchSize: 5,
        maxBatchingWindow: cdk.Duration.seconds(10),
        reportBatchItemFailures: true,
      })
    );

    // -----------------------------------------------------------------------
    // Stack outputs
    // -----------------------------------------------------------------------
    new cdk.CfnOutput(this, "EmailQueueUrl", { value: emailQueue.queueUrl });
    new cdk.CfnOutput(this, "AiQueueUrl", { value: aiQueue.queueUrl });
    new cdk.CfnOutput(this, "EmailWorkerArn", { value: emailWorker.functionArn });
    new cdk.CfnOutput(this, "AiWorkerArn", { value: aiWorker.functionArn });
  }
}

