import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/contexts/workspace-context";
import { Inbox } from "lucide-react";

interface ContentRun {
  runId: string;
  clientId: number;
  status: string;
  totalPieces: number;
  successfulPieces: number;
  failedPieces: number;
  startedAt: string;
  completedAt?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  generating: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function Briefs() {
  const { workspaceId, clients, activeClient } = useWorkspace();
  const { data: runs = [], isLoading } = useQuery<ContentRun[]>({
    queryKey: ["/api/content-runs"],
  });

  const clientName = (id: number) =>
    clients.find((c) => c.id === id)?.name ?? `Client ${id}`;

  const visible =
    workspaceId === "all"
      ? runs
      : runs.filter((r) => String(r.clientId) === workspaceId);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Inbox className="w-6 h-6 text-cyan-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Briefs</h1>
          <p className="text-sm text-zinc-500">
            {workspaceId === "all"
              ? "Generation runs across all workspaces"
              : `Generation runs for ${activeClient?.name ?? "this workspace"}`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : visible.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800 p-8 text-center">
          <p className="text-zinc-400">No briefs yet.</p>
          <p className="text-sm text-zinc-600 mt-1">
            Hit <span className="text-cyan-400">New Brief</span> in the top bar to generate your first piece.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((run) => (
            <Card
              key={run.runId}
              className="bg-zinc-900 border-zinc-800 p-4 flex items-center justify-between"
              data-testid={`brief-run-${run.runId}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium truncate">{clientName(run.clientId)}</span>
                  <Badge
                    variant="outline"
                    className={STATUS_STYLES[run.status] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"}
                  >
                    {run.status}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500 mt-1 font-mono truncate">{run.runId}</p>
              </div>
              <div className="text-right text-sm flex-shrink-0">
                <span className="text-green-400">{run.successfulPieces}</span>
                <span className="text-zinc-600"> / </span>
                <span className="text-zinc-400">{run.totalPieces}</span>
                {run.failedPieces > 0 && (
                  <span className="text-red-400"> · {run.failedPieces} failed</span>
                )}
                <p className="text-xs text-zinc-600 mt-1">
                  {new Date(run.startedAt).toLocaleString()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
