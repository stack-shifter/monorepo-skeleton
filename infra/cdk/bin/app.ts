import * as cdk from "aws-cdk-lib";
import { RealEstateWorkerStack } from "../lib/stacks/stack";

const app = new cdk.App();

new RealEstateWorkerStack(app, "RealEstateWorkers-Staging", {
  dbSecretName: "real-estate/staging/db",
  environment: "staging",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
});

new RealEstateWorkerStack(app, "RealEstateWorkers-Production", {
  dbSecretName: "real-estate/production/db",
  environment: "production",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
});

app.synth();
