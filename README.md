# netlify-sentry-v2

![npm package](https://img.shields.io/npm/v/@neptune.digital/sentry-netlify-v2)

## Installation

1. Either:
   a) Set the SENTRY_DSN environment variable in your site configuration, or
   b) Enable the [Netlify Sentry Integration](https://www.netlify.com/integrations/sentry/),
   and make sure your DSN is set in the UI. (This does the same thing.)

2. `npm i @neptune.digital/netlify-sentry-v2`

3. Use it in your functions as shown below.

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

Note that this doesn't change anything about the function, so you can use it 
on any function that you want to do a cron check-in call to Sentry.
