import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  getActiveWorkspace,
  setActiveWorkspace,
  type WorkspaceId,
} from "@/lib/workspace";

export interface WorkspaceClient {
  id: number;
  name: string;
  industry?: string;
  /** "real_estate" | "pools" | … — drives archetype menus + compliance UI. */
  vertical?: string | null;
}

interface WorkspaceContextValue {
  /** "all" or a numeric client id (string). */
  workspaceId: WorkspaceId;
  /** The resolved client object, or undefined for "all" / not-yet-loaded. */
  activeClient: WorkspaceClient | undefined;
  /** All clients available to switch between. */
  clients: WorkspaceClient[];
  isLoading: boolean;
  setWorkspace: (id: WorkspaceId) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId>(getActiveWorkspace());

  const { data: clients = [], isLoading } = useQuery<WorkspaceClient[]>({
    queryKey: ["/api/clients"],
  });

  const setWorkspace = useCallback((id: WorkspaceId) => {
    setActiveWorkspace(id);
    setWorkspaceId(id);
    // Every query is workspace-scoped via the X-Client-Id header, so flush
    // the cache to refetch under the new scope.
    queryClient.invalidateQueries();
  }, []);

  const activeClient =
    workspaceId === "all"
      ? undefined
      : clients.find((c) => String(c.id) === workspaceId);

  return (
    <WorkspaceContext.Provider
      value={{ workspaceId, activeClient, clients, isLoading, setWorkspace }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
