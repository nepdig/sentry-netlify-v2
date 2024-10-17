import type { Context } from "@netlify/functions";
import * as Sentry from "@sentry/aws-serverless";

type NetlifyHandlerV2 = (
  req: Request,
  context: Context
) => Promise<Response | undefined>;

const FLUSH_TIMEOUT_MS = 2000;

function getEnvironment(req: Request, netlifyContext: Context): string {
  let environment = netlifyContext.deploy.context;
  if (environment === "branch-deploy") {
    environment = new URL(req.url).hostname.split(".")[0];
  }
  return environment;
}

export const withSentryAsBackgroundTask = (
  monitorSlug: string,
  handler: NetlifyHandlerV2
): NetlifyHandlerV2 => {
  return withSentry(async (req, netlifyContext) => {
    Sentry.getActiveSpan()?.setAttribute("faas.trigger", "timer");
    const startTime = performance.now();

    const checkInDescription = {
      monitorSlug,
      release: netlifyContext.deploy.id,
      environment: getEnvironment(req, netlifyContext),
    };

    Sentry.captureCheckIn({
      ...checkInDescription,
      status: "in_progress",
    });
    try {
      const rv = handler(req, netlifyContext);
      try {
        Sentry.captureCheckIn({
          ...checkInDescription,
          status: "ok",
          duration: (performance.now() - startTime) / 1000.0,
        });
      } catch (e) {
        console.log("Failed to capture Sentry check-in with success:", e);
      }
      return rv;
    } catch (e) {
      try {
        Sentry.captureCheckIn({
          ...checkInDescription,
          status: "error",
          duration: (performance.now() - startTime) / 1000.0,
        });
      } catch (e) {
        console.log("Failed to capture Sentry check-in with error:", e);
      }
      throw e;
    }
  });
};

const extractFileBaseNameFromPathRegex = /([^/]+)\.[^.]+$/;

export const withSentry = (handler: NetlifyHandlerV2): NetlifyHandlerV2 => {
  return (req: Request, netlifyContext: Context) => {
    const urlObject = new URL(req.url);
    let fileName: string | undefined;
    try {
      fileName = __filename;
    } catch {
      try {
        fileName = import.meta.filename;
      } catch {
        fileName = undefined;
      }
    }
    const functionName =
      fileName && extractFileBaseNameFromPathRegex.exec(fileName)?.[1];
    const functionSpanName =
      functionName ??
      extractFileBaseNameFromPathRegex.exec(urlObject.pathname)?.[1] ??
      urlObject.pathname ??
      "";

    const processResult = () => {
      let rv: ReturnType<typeof handler>;
      try {
        rv = handler(req, netlifyContext);
      } catch (e) {
        Sentry.captureException(e);
        throw e;
      }

      return rv;
    };

    const functionSpan = () => {
      return Sentry.startSpanManual(
        {
          name: functionSpanName,
          op: "function.netlify",
          attributes: {
            "faas.name": functionName,
            // let Sentry set cloud.resource_id if it can find it
            "faas.invocation_id": netlifyContext.requestId,
            "faas.trigger": "http",
            "sentry.source": "component",
            "sentry.origin": "auto.function.netlify",
            "code.filepath": fileName,
            environment: getEnvironment(req, netlifyContext),
            release: netlifyContext.deploy.id,
          },
        },
        (span) =>
          processResult()
            .then((r) => {
              span.setStatus({ code: 1, message: "ok" });
              return r;
            })
            .catch((e: Error) => {
              span.setStatus({ code: 2, message: e.message });
              throw e;
            })
            .finally(() => {
              span.end();
            })
      );
    };

    const httpSpan = () =>
      Sentry.startSpanManual(
        {
          name: `${req.method} ${urlObject.pathname}`,
          op: "http.server",
          attributes: {
            "http.request.method": req.method,
            "http.method": req.method,
            "url.path": urlObject.pathname,
            "url.scheme": urlObject.protocol.replace(/:$/, ""),
            "url.query": urlObject.search.replace(/^\?/, ""),
            "client.address": netlifyContext.ip,
            "user_agent.original": req.headers.get("user-agent") || undefined,
            "sentry.source": "url",
            "sentry.origin": "auto.function.netlify",
            "http.query": urlObject.search,
            environment: getEnvironment(req, netlifyContext),
            release: netlifyContext.deploy.id,
          },
        },
        async (span) => {
          return functionSpan()
            .then((response) => {
              if (response) {
                const statusString = getTraceStatusString(response.status);
                span.setAttributes({
                  "http.response.status_code": response.status,
                });
                span.setStatus({
                  code: statusString === "ok" ? 1 : 2,
                  message: statusString,
                });
                for (const entry of req.headers.entries()) {
                  span.setAttributes({
                    ["http.request.header." + entry[0]]: entry[1],
                  });
                }
                for (const entry of response.headers.entries()) {
                  span.setAttributes({
                    ["http.response.header." + entry[0]]: entry[1],
                  });
                }
              } else {
                span.setStatus({ code: 2, message: "undefined" });
              }
              return response;
            })
            .catch((e) => {
              span.setStatus({ code: 2, message: e.message });
              throw e;
            })
            .finally(() => {
              span.end();
            });
        }
      );

    const httpSpanWithTrace = () =>
      Sentry.continueTrace(
        {
          sentryTrace: req.headers.get("sentry-trace") || undefined,
          baggage: req.headers.get("baggage"),
        },
        httpSpan
      );

    return Sentry.withIsolationScope((scope) => {
      scope.setTransactionName(functionName);
      scope.setContext("netlify", netlifyContext);
      scope.setContext("cloud_resource", {
        "cloud.provider": "netlify",
        "cloud.account.id": netlifyContext.account.id,
        "cloud.region": netlifyContext.server.region,
        "cloud.platform": "netlify_functions",
      });
      scope.setTags({
        environment: getEnvironment(req, netlifyContext),
        release: netlifyContext.deploy.id,
        server_name: netlifyContext.url?.hostname || urlObject.hostname,
      });

      return httpSpanWithTrace();
    }).finally(() => Sentry.flush(FLUSH_TIMEOUT_MS));
  };
};

function getTraceStatusString(status: number): string {
  if (status >= 200 && status < 300) {
    return "ok";
  }

  switch (status) {
    case 400:
      return "invalid_argument";
    case 401:
      return "unauthenticated";
    case 403:
      return "permission_denied";
    case 404:
      return "not_found";
    case 409:
      return "already_exists";
    case 429:
      return "resource_exhausted";
    case 499:
      return "cancelled";
    case 500:
      return "unknown_error";
    case 501:
      return "unimplemented";
    case 503:
      return "unavailable";
    case 504:
      return "deadline_exceeded";
  }

  return "unknown";
}
