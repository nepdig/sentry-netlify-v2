import * as Sentry from "@sentry/aws-serverless";
import * as packageJson from "../package.json";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  _metadata: {
    sdk: {
      name: "sentry-netlify-v2",
      integrations: ["AWSLambda"],
      packages: [
        {
          name: "npm:@sentry/aws-serverless",
          version: Sentry.SDK_VERSION,
        },
        {
          name: "npm:@neptune.digital/sentry-netlify-v2",
          version: packageJson.default.version,
        },
      ],
      version: packageJson.default.version,
    },
  },
});

export { withSentry, withSentryAsBackgroundTask } from "./wrappers.mjs";
