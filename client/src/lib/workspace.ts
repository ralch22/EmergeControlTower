/**
 * Active-workspace state, shared between the React context and the
 * queryClient. ECT serves multiple client brands (J Pools, Acc, …); the
 * workspace switcher picks which one is in focus. The selection is sent on
 * every request as the X-Client-Id header, which the server's clientScope
 * middleware turns into req.clientId (see server/middleware/client-scope.ts).
 *
 * Value "all" = all-workspaces portfolio view (server returns cross-client
 * data). A numeric string = that client's id.
 */
const STORAGE_KEY = "emerge.workspace";

export type WorkspaceId = "all" | string;

export function getActiveWorkspace(): WorkspaceId {
  if (typeof localStorage === "undefined") return "all";
  return localStorage.getItem(STORAGE_KEY) || "all";
}

export function setActiveWorkspace(id: WorkspaceId): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
}

/**
 * Header to attach to every API request. Omitted for "all" so the server
 * falls through to its unscoped path.
 */
export function workspaceHeader(): Record<string, string> {
  const id = getActiveWorkspace();
  return id && id !== "all" ? { "X-Client-Id": id } : {};
}
