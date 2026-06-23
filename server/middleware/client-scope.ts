import type { Request, Response, NextFunction } from "express";

/**
 * Client-scope middleware.
 *
 * ECT v1 has no in-app login — Cloudflare Access gates the whole Worker,
 * so every request that reaches Express is an authenticated Emerge
 * operator. We don't need auth here; we need *workspace scope* so one
 * client's data (alerts, approvals, KPIs) doesn't bleed into another's
 * once we onboard client #2 (Acc) alongside J Pools.
 *
 * Scope resolution order (first hit wins):
 *   1. req.params.clientId   — RESTful routes like /api/clients/:clientId/...
 *   2. X-Client-Id header    — the workspace switcher sends this
 *   3. req.body.clientId     — POST bodies that name a client
 *
 * Special value "all" → req.clientId = undefined → "All Workspaces"
 * portfolio view (storage methods return cross-client data).
 *
 * No header / no param / no body field → undefined → unscoped, which
 * preserves the pre-multi-tenant behaviour of existing routes. Scoping is
 * therefore OPT-IN per request: the new UI opts in by sending the header;
 * legacy/ops routes keep working unchanged.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Resolved workspace scope. undefined = all workspaces / unscoped. */
      clientId?: number;
    }
  }
}

function parseClientId(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim().toLowerCase();
  if (s === "" || s === "all") return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function clientScope(req: Request, _res: Response, next: NextFunction): void {
  const fromParam = req.params?.clientId;
  const fromHeader = req.header("x-client-id");
  const fromBody = (req.body as { clientId?: unknown } | undefined)?.clientId;

  // params win, then header, then body. parseClientId turns "all"/empty
  // into undefined so a present-but-"all" param doesn't shadow a real
  // header scope further down — but params genuinely naming a client win.
  req.clientId =
    parseClientId(fromParam) ??
    parseClientId(fromHeader) ??
    parseClientId(fromBody);

  next();
}
