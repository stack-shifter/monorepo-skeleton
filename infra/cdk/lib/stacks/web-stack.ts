import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

interface RealEstateWebStackProps extends cdk.StackProps {
  dbSecretName: string;
  ghcrCredentialsSecretName: string;
  apiImageUri: string;
  uiImageUri: string;
  environment: "staging" | "production";
}

export class RealEstateWebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RealEstateWebStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName: `real-estate-web-${props.environment}`,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    const dbSecret = secretsmanager.Secret.fromSecretNameV2(this, "DbSecret", props.dbSecretName);
    const registryCredentialsSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "RegistryCredentialsSecret",
      props.ghcrCredentialsSecretName
    );

    const albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
      vpc,
      description: "Ingress for UI and API ALB",
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow HTTP ingress");

    const serviceSecurityGroup = new ec2.SecurityGroup(this, "ServiceSecurityGroup", {
      vpc,
      description: "Ingress from ALB to ECS services",
      allowAllOutbound: true,
    });
    serviceSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcpRange(3000, 3001),
      "Allow ALB to reach web containers"
    );

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      loadBalancerName: `real-estate-web-${props.environment}`,
    });

    const listener = loadBalancer.addListener("HttpListener", {
      port: 80,
      open: false,
    });

    const apiTaskDefinition = new ecs.FargateTaskDefinition(this, "ApiTaskDefinition", {
      cpu: 512,
      memoryLimitMiB: 1024,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
      },
    });

    const apiLogGroup = new logs.LogGroup(this, "ApiLogGroup", {
      logGroupName: `/ecs/real-estate-api-${props.environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const apiContainer = apiTaskDefinition.addContainer("ApiContainer", {
      image: ecs.ContainerImage.fromRegistry(props.apiImageUri, {
        credentials: registryCredentialsSecret,
      }),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "api",
        logGroup: apiLogGroup,
      }),
      environment: {
        NODE_ENV: props.environment,
        PORT: "3001",
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(dbSecret, "url"),
      },
    });
    apiContainer.addPortMappings({ containerPort: 3001 });

    const apiService = new ecs.FargateService(this, "ApiService", {
      cluster,
      taskDefinition: apiTaskDefinition,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      assignPublicIp: true,
      securityGroups: [serviceSecurityGroup],
      serviceName: `real-estate-api-${props.environment}`,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const apiTargetGroup = new elbv2.ApplicationTargetGroup(this, "ApiTargetGroup", {
      vpc,
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/api/health",
        interval: cdk.Duration.seconds(30),
        healthyHttpCodes: "200",
      },
    });
    apiTargetGroup.addTarget(
      apiService.loadBalancerTarget({
        containerName: "ApiContainer",
        containerPort: 3001,
      })
    );

    const uiTaskDefinition = new ecs.FargateTaskDefinition(this, "UiTaskDefinition", {
      cpu: 512,
      memoryLimitMiB: 1024,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
      },
    });

    const uiLogGroup = new logs.LogGroup(this, "UiLogGroup", {
      logGroupName: `/ecs/real-estate-ui-${props.environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const uiContainer = uiTaskDefinition.addContainer("UiContainer", {
      image: ecs.ContainerImage.fromRegistry(props.uiImageUri, {
        credentials: registryCredentialsSecret,
      }),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "ui",
        logGroup: uiLogGroup,
      }),
      environment: {
        NODE_ENV: props.environment,
        PORT: "3000",
        HOSTNAME: "0.0.0.0",
        API_BASE_URL: `http://${loadBalancer.loadBalancerDnsName}/api`,
      },
    });
    uiContainer.addPortMappings({ containerPort: 3000 });

    const uiService = new ecs.FargateService(this, "UiService", {
      cluster,
      taskDefinition: uiTaskDefinition,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      assignPublicIp: true,
      securityGroups: [serviceSecurityGroup],
      serviceName: `real-estate-ui-${props.environment}`,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const uiTargetGroup = new elbv2.ApplicationTargetGroup(this, "UiTargetGroup", {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/_health",
        interval: cdk.Duration.seconds(30),
        healthyHttpCodes: "200",
      },
    });
    uiTargetGroup.addTarget(
      uiService.loadBalancerTarget({
        containerName: "UiContainer",
        containerPort: 3000,
      })
    );

    listener.addTargetGroups("ApiRoutes", {
      priority: 10,
      targetGroups: [apiTargetGroup],
      conditions: [elbv2.ListenerCondition.pathPatterns(["/api/*"])],
    });

    listener.addTargetGroups("UiRoutes", {
      targetGroups: [uiTargetGroup],
    });

    new cdk.CfnOutput(this, "LoadBalancerDnsName", {
      value: loadBalancer.loadBalancerDnsName,
    });
    new cdk.CfnOutput(this, "ApiServiceName", { value: apiService.serviceName });
    new cdk.CfnOutput(this, "UiServiceName", { value: uiService.serviceName });
  }
}
