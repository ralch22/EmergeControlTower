import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Request logger. Captures response bodies in development for debugging;
// in production we drop the body entirely because Cloudflare Logs receive
// stdout verbatim and several routes round-trip credentials (WordPress
// passwords, AI provider configs, OAuth tokens). Status + duration is
// enough operational signal in prod.
const IS_PROD = process.env.NODE_ENV === "production";
const LOG_BODY_MAX = 200; // chars, dev only

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  if (!IS_PROD) {
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (!IS_PROD && capturedJsonResponse) {
        const body = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${body.length > LOG_BODY_MAX ? body.slice(0, LOG_BODY_MAX) + "...[truncated]" : body}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // In production, never echo err.message to the client — it can carry
    // raw DB errors ("password authentication failed for user 'ect_app'"),
    // file paths, and other internal detail. Log the full error server-side
    // and return a generic 5xx message. 4xx errors are usually intentional
    // (user input validation) so we keep their message.
    const safeMessage =
      IS_PROD && status >= 500
        ? "Internal Server Error"
        : (err.message || "Internal Server Error");

    res.status(status).json({ message: safeMessage });

    // Don't re-throw — it crashes after response is sent (no recovery),
    // and the stack hits stdout → CF Logs. Log explicitly instead.
    log(`error ${status} on ${_req.method} ${_req.path}: ${err.message ?? err}`);
    if (err.stack) console.error(err.stack);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    port,
    "0.0.0.0",
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
