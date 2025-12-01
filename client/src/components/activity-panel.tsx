import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ActiveRun = {
  runId: string;
  clientId: number;
  clientName?: string;
  status: string;
  totalPieces: number;
  successfulPieces: number;
  failedPieces: number;
  progress: number;
  startedAt: string;
};

type ActivityLogEntry = {
  id: number;
  runId: string;
  eventType: string;
  level: string;
  message: string;
  metadata?: string;
  createdAt: string;
};

type PipelineStatus = {
  isActive: boolean;
  activeRuns: ActiveRun[];
  recentActivity: ActivityLogEntry[];
};

type Client = {
  id: number;
  name: string;
};

const levelConfig: Record<string, { color: string; bgColor: string; icon: React.ReactNode }> = {
  info: {
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    icon: <Info className="w-3 h-3" />,
  },
  success: {
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  warning: {
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  error: {
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    icon: <XCircle className="w-3 h-3" />,
  },
};

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ActivityPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previousRuns, setPreviousRuns] = useState<Map<string, ActiveRun>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: pipelineStatus } = useQuery<PipelineStatus>({
    queryKey: ["/api/pipeline-status"],
    queryFn: async () => {
      const res = await fetch("/api/pipeline-status");
      if (!res.ok) throw new Error("Failed to fetch pipeline status");
      return res.json();
    },
    refetchInterval: isExpanded ? 3000 : 10000,
    enabled: true,
  });

  const getClientName = (clientId: number): string => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || `Client #${clientId}`;
  };

  useEffect(() => {
    if (!pipelineStatus) return;

    const currentRunIds = new Set(pipelineStatus.activeRuns.map((r) => r.runId));
    
    previousRuns.forEach((prevRun, runId) => {
      if (!currentRunIds.has(runId)) {
        const isCompleted = pipelineStatus.recentActivity.some(
          (log) => log.runId === runId && log.eventType === "run_completed"
        );
        const isFailed = pipelineStatus.recentActivity.some(
          (log) => log.runId === runId && log.eventType === "run_failed"
        );

        const clientName = getClientName(prevRun.clientId);

        if (isCompleted) {
          toast.success(`Pipeline completed for ${clientName}`, {
            description: `Generated ${prevRun.totalPieces} pieces (${prevRun.successfulPieces} passed, ${prevRun.failedPieces} failed)`,
          });
        } else if (isFailed) {
          const errorLog = pipelineStatus.recentActivity.find(
            (log) => log.runId === runId && log.level === "error"
          );
          toast.error(`Pipeline failed for ${clientName}`, {
            description: errorLog?.message || "An error occurred during content generation",
          });
        }
      }
    });

    const newRunsMap = new Map<string, ActiveRun>();
    pipelineStatus.activeRuns.forEach((run) => {
      newRunsMap.set(run.runId, run);
    });
    setPreviousRuns(newRunsMap);
  }, [pipelineStatus, clients]);

  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [pipelineStatus?.recentActivity, isExpanded]);

  const activeRunCount = pipelineStatus?.activeRuns?.length || 0;
  const isActive = pipelineStatus?.isActive || false;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isExpanded ? (
        <Button
          onClick={() => setIsExpanded(true)}
          className={cn(
            "relative h-12 w-12 rounded-full shadow-lg border",
            "bg-zinc-900 border-zinc-700 hover:bg-zinc-800 hover:border-cyan-500/50",
            "transition-all duration-300"
          )}
          data-testid="panel-activity-toggle"
        >
          <Activity className={cn("w-5 h-5", isActive ? "text-cyan-400" : "text-zinc-400")} />
          {activeRunCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-cyan-500 text-white border-0 text-xs"
              data-testid="badge-active-runs"
            >
              {activeRunCount}
            </Badge>
          )}
          {isActive && (
            <span className="absolute -top-1 -right-1 h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            </span>
          )}
        </Button>
      ) : (
        <div
          className={cn(
            "w-80 max-h-[500px] rounded-lg shadow-xl border overflow-hidden",
            "bg-zinc-900/95 backdrop-blur-sm border-zinc-700",
            "animate-in slide-in-from-bottom-5 duration-300"
          )}
          data-testid="panel-activity-expanded"
        >
          <div className="flex items-center justify-between p-3 border-b border-zinc-700 bg-zinc-800/50">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  isActive ? "bg-green-400 animate-pulse" : "bg-zinc-500"
                )}
                data-testid="status-pipeline-active"
              />
              <h3 className="font-medium text-white text-sm">Pipeline Activity</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-zinc-700"
              data-testid="panel-activity-toggle"
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>

          {pipelineStatus?.activeRuns && pipelineStatus.activeRuns.length > 0 && (
            <div className="p-3 border-b border-zinc-700 space-y-3">
              {pipelineStatus.activeRuns.map((run) => (
                <div
                  key={run.runId}
                  className="p-2 bg-zinc-800/50 rounded-md border border-zinc-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-cyan-400">
                      {getClientName(run.clientId)}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {run.progress}%
                    </span>
                  </div>
                  <Progress
                    value={run.progress}
                    className="h-2 bg-zinc-700"
                    data-testid="progress-bar-pipeline"
                  />
                  <div className="flex items-center justify-between mt-2 text-xs text-zinc-400">
                    <span>
                      {run.successfulPieces + run.failedPieces} / {run.totalPieces} pieces
                    </span>
                    <span className="text-green-400">
                      {run.successfulPieces} passed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Recent Activity
              </span>
              <span className="text-xs text-zinc-500">
                {pipelineStatus?.recentActivity?.length || 0} logs
              </span>
            </div>
            <ScrollArea className="h-[250px]" data-testid="list-activity-logs">
              <div ref={scrollRef} className="space-y-1.5 pr-2">
                {pipelineStatus?.recentActivity?.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No recent activity</p>
                  </div>
                ) : (
                  pipelineStatus?.recentActivity?.map((log) => {
                    const config = levelConfig[log.level] || levelConfig.info;
                    return (
                      <div
                        key={log.id}
                        className={cn(
                          "p-2 rounded text-xs transition-colors",
                          config.bgColor,
                          "hover:brightness-110"
                        )}
                        data-testid={`text-activity-log-${log.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={cn("mt-0.5 flex-shrink-0", config.color)}>
                            {config.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-zinc-200 leading-snug break-words">
                              {log.message}
                            </p>
                            <p className="text-zinc-500 mt-1">
                              {formatTimestamp(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
