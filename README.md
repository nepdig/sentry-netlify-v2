# netlify-sentry-v2

![npm package](https://img.shields.io/npm/v/@neptune.digital/sentry-netlify-v2)

## Installation

1. Enable the [Netlify Sentry Integration](https://www.netlify.com/integrations/sentry/).
   Make sure your DSN is set. This will propagate the right environment variables into 
   your runtime environments.

2. npm i @neptune.digital/netlify-sentry-v2

3. Use it!

## Usage

At the **top** of your Netlify Functions file:

```ts
import { withSentry } from "@neptune.digital/netlify-sentry-v2";
import type { Context } from "@netlify/functions";

export default withSentry(async (req: Request, context: Context) => {
    // blah blah function goes here
    return new Response("wow", {status: 200});
});
```

### Background Functions

There's also a `withSentryAsBackgroundTask`:

```ts
import { withSentryAsBackgroundTask } from "@neptune.digital/netlify-sentry-v2";
import type { Config, Context } from "@netlify/functions";

export default withSentryAsBackgroundTask(
    "your-sentry-cron-slug",
    async (req: Request, context: Context) => {
        return new Response("wow, at some scheduled time", {status: 200});
});


export const config: Config = {
  schedule: "*/5 * * * *", // cron format. every 5 minutes
};
```
