import * as Sentry from "@sentry/aws-serverless";

const VERSION = "1.0.0";

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
          version: VERSION,
        },
      ],
      version: VERSION,
    },
  },
});

export { withSentry, withSentryAsBackgroundTask } from "./wrappers.mjs";
