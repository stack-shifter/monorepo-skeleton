import * as cdk from "aws-cdk-lib";
import { RealEstateWebStack } from "../lib/stacks/web-stack";
import { RealEstateWorkerStack } from "../lib/stacks/worker-stack";

const app = new cdk.App();

const apiImageUri = process.env.CDK_API_IMAGE_URI ?? "ghcr.io/example/saas/api:latest";
const uiImageUri = process.env.CDK_UI_IMAGE_URI ?? "ghcr.io/example/saas/ui:latest";
const ghcrCredentialsSecretName =
  process.env.CDK_GHCR_CREDENTIALS_SECRET_NAME ?? "ghcr/pull-credentials";

new RealEstateWebStack(app, "RealEstateWeb-Staging", {
  dbSecretName: "real-estate/staging/db",
  ghcrCredentialsSecretName,
  apiImageUri,
  uiImageUri,
  environment: "staging",
});

new RealEstateWorkerStack(app, "RealEstateWorkers-Staging", {
  dbSecretName: "real-estate/staging/db",
  environment: "staging",
});

new RealEstateWebStack(app, "RealEstateWeb-Production", {
  dbSecretName: "real-estate/production/db",
  ghcrCredentialsSecretName,
  apiImageUri,
  uiImageUri,
  environment: "production",
});

new RealEstateWorkerStack(app, "RealEstateWorkers-Production", {
  dbSecretName: "real-estate/production/db",
  environment: "production",
});

app.synth();
