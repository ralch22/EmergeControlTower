import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Minimize2,
  Maximize2,
  Zap,
  Play,
  Pause,
  FileText,
  Video,
  Image,
  Loader2,
  AlertCircle,
  Server,
  TrendingUp,
  Timer,
  List,
  Layers,
  Cpu,
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

type ProviderStatus = {
  name: string;
  status: "working" | "limited" | "error" | "not_configured";
};

type ProvidersResponse = {
  timestamp: string;
  providers: Record<string, ProviderStatus>;
};

type Client = {
  id: number;
  name: string;
};

type RunLifecycleState = "queued" | "initializing" | "generating" | "qa" | "completing" | "completed" | "failed";

const levelConfig: Record<string, { color: string; bgColor: string; icon: React.ReactNode; priority: number }> = {
  error: {
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
    icon: <XCircle className="w-3 h-3" />,
    priority: 4,
  },
  warning: {
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10 border-yellow-500/20",
    icon: <AlertTriangle className="w-3 h-3" />,
    priority: 3,
  },
  success: {
    color: "text-green-400",
    bgColor: "bg-green-500/10 border-green-500/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
    priority: 2,
  },
  info: {
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10 border-cyan-500/20",
    icon: <Info className="w-3 h-3" />,
    priority: 1,
  },
};

const eventTypeIcons: Record<string, React.ReactNode> = {
  content_started: <FileText className="w-3 h-3" />,
  content_completed: <CheckCircle2 className="w-3 h-3" />,
  content_failed: <XCircle className="w-3 h-3" />,
  video_started: <Video className="w-3 h-3" />,
  video_completed: <Video className="w-3 h-3" />,
  image_generated: <Image className="w-3 h-3" />,
  topic_generated: <Zap className="w-3 h-3" />,
  run_started: <Play className="w-3 h-3" />,
  run_completed: <CheckCircle2 className="w-3 h-3" />,
  run_failed: <XCircle className="w-3 h-3" />,
  qa_started: <AlertCircle className="w-3 h-3" />,
  qa_passed: <CheckCircle2 className="w-3 h-3" />,
  qa_failed: <XCircle className="w-3 h-3" />,
  video_provider_error: <Server className="w-3 h-3" />,
  video_scene_failed: <Video className="w-3 h-3" />,
};

const lifecycleSteps: { state: RunLifecycleState; label: string; color: string }[] = [
  { state: "queued", label: "Queued", color: "bg-zinc-500" },
  { state: "initializing", label: "Init", color: "bg-blue-500" },
  { state: "generating", label: "Generating", color: "bg-cyan-500" },
  { state: "qa", label: "QA", color: "bg-purple-500" },
  { state: "completing", label: "Finishing", color: "bg-yellow-500" },
  { state: "completed", label: "Done", color: "bg-green-500" },
];

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${diffHour}h ${diffMin % 60}m ago`;
}

function getRunLifecycleState(run: ActiveRun, logs: ActivityLogEntry[]): RunLifecycleState {
  if (run.status === "completed") return "completed";
  if (run.status === "failed") return "failed";
  
  const runLogs = logs.filter(l => l.runId === run.runId);
  const hasRunStarted = runLogs.some(l => l.eventType === "run_started");
  const hasTopics = runLogs.some(l => l.eventType === "topic_generated");
  const hasContentStarted = runLogs.some(l => l.eventType === "content_started");
  const hasContentCompleted = runLogs.some(l => l.eventType === "content_completed");
  const hasQA = runLogs.some(l => l.eventType.includes("qa"));
  const allContentDone = run.totalPieces > 0 && 
    (run.successfulPieces + run.failedPieces) >= run.totalPieces * 0.9;
  
  if (!hasRunStarted) return "queued";
  if (hasRunStarted && !hasTopics && !hasContentStarted) return "initializing";
  if (hasQA) return "qa";
  if (allContentDone && !hasQA) return "completing";
  if (hasContentStarted || hasContentCompleted || hasTopics) return "generating";
  
  return "initializing";
}

function getLifecycleStepIndex(state: RunLifecycleState): number {
  const index = lifecycleSteps.findIndex(s => s.state === state);
  return index >= 0 ? index : 0;
}

function GlobalStatusBar({ 
  activeRuns, 
  queueDepth,
  criticalCount, 
  warningCount,
  isActive,
  providers,
}: { 
  activeRuns: number; 
  queueDepth: number;
  criticalCount: number; 
  warningCount: number;
  isActive: boolean;
  providers: Record<string, ProviderStatus>;
}) {
  const providerEntries = Object.entries(providers);
  const workingCount = providerEntries.filter(([, p]) => p.status === "working").length;
  const limitedCount = providerEntries.filter(([, p]) => p.status === "limited").length;
  const errorCount = providerEntries.filter(([, p]) => p.status === "error").length;
  const limitedProviders = providerEntries.filter(([, p]) => p.status === "limited").map(([name]) => name);
  const errorProviders = providerEntries.filter(([, p]) => p.status === "error").map(([name]) => name);
  
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-zinc-800/80 border-b border-zinc-700">
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-2 h-2 rounded-full",
          isActive ? "bg-green-400 animate-pulse" : "bg-zinc-500"
        )} />
        <span className="text-xs font-medium text-zinc-300">
          {isActive ? "Active" : "Idle"}
        </span>
      </div>
      
      <div className="h-4 w-px bg-zinc-700" />
      
      <div className="flex items-center gap-1.5" title="Active runs">
        <Loader2 className={cn("w-3 h-3", activeRuns > 0 ? "text-cyan-400 animate-spin" : "text-zinc-500")} />
        <span className="text-xs text-zinc-400">{activeRuns}</span>
      </div>
      
      <div className="flex items-center gap-1.5" title="Queue depth">
        <List className="w-3 h-3 text-zinc-500" />
        <span className="text-xs text-zinc-400">{queueDepth}</span>
      </div>
      
      <div className="h-4 w-px bg-zinc-700" />
      
      <div className="flex items-center gap-1.5" title="Providers">
        <Cpu className="w-3 h-3 text-zinc-500" />
        <div className="flex items-center gap-1">
          {workingCount > 0 && (
            <Badge 
              className="h-4 text-[10px] px-1 bg-green-500/20 text-green-400 border-0"
              title={`${workingCount} working`}
            >
              {workingCount}
            </Badge>
          )}
          {limitedCount > 0 && (
            <Badge 
              className="h-4 text-[10px] px-1 bg-yellow-500/20 text-yellow-400 border-0"
              title={`Limited: ${limitedProviders.join(", ")}`}
            >
              {limitedCount}
            </Badge>
          )}
          {errorCount > 0 && (
            <Badge 
              className="h-4 text-[10px] px-1 bg-red-500/20 text-red-400 border-0"
              title={`Error: ${errorProviders.join(", ")}`}
            >
              {errorCount}
            </Badge>
          )}
        </div>
      </div>
      
      {criticalCount > 0 && (
        <>
          <div className="h-4 w-px bg-zinc-700" />
          <Badge variant="destructive" className="h-5 text-xs px-1.5 bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            {criticalCount}
          </Badge>
        </>
      )}
      
      {warningCount > 0 && (
        <Badge className="h-5 text-xs px-1.5 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {warningCount}
        </Badge>
      )}
    </div>
  );
}

function RunCard({
  run,
  clientName,
  lifecycleState,
  recentLogs,
  errorCount,
  isExpanded,
  onToggle,
}: {
  run: ActiveRun;
  clientName: string;
  lifecycleState: RunLifecycleState;
  recentLogs: ActivityLogEntry[];
  errorCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const currentStep = lifecycleSteps.find(s => s.state === lifecycleState) || lifecycleSteps[0];
  const currentStepIndex = getLifecycleStepIndex(lifecycleState);
  const runtime = formatRelativeTime(run.startedAt);
  
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className={cn(
        "rounded-lg border transition-all",
        lifecycleState === "failed" 
          ? "bg-red-500/5 border-red-500/30" 
          : "bg-zinc-800/50 border-zinc-700 hover:border-zinc-600"
      )}>
        <CollapsibleTrigger asChild>
          <div className="p-3 cursor-pointer" data-testid={`run-card-${run.runId}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ChevronRight className={cn(
                  "w-4 h-4 text-zinc-400 transition-transform",
                  isExpanded && "rotate-90"
                )} />
                <span className="text-sm font-medium text-white truncate max-w-[140px]">
                  {clientName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {errorCount > 0 && (
                  <Badge variant="destructive" className="h-5 text-xs px-1.5 bg-red-500/20 text-red-400 border-0">
                    {errorCount}
                  </Badge>
                )}
                <Badge className={cn(
                  "h-5 text-xs px-1.5 border-0",
                  currentStep.color.replace("bg-", "bg-") + "/20",
                  currentStep.color.replace("bg-", "text-").replace("-500", "-400")
                )}>
                  {currentStep.label}
                </Badge>
              </div>
            </div>
            
            <div className="flex gap-0.5 mb-2">
              {lifecycleSteps.slice(0, -1).map((step, i) => {
                const isActive = currentStepIndex >= i;
                const isCurrent = step.state === lifecycleState;
                return (
                  <div
                    key={step.state}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-all",
                      isActive ? step.color : "bg-zinc-700",
                      isCurrent && "animate-pulse"
                    )}
                    title={step.label}
                  />
                );
              })}
            </div>
            
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <div className="flex items-center gap-1">
                <Timer className="w-3 h-3" />
                <span>{runtime}</span>
              </div>
              <div className="flex items-center gap-3">
                {run.totalPieces > 0 && (
                  <span className="text-zinc-500">
                    {run.successfulPieces + run.failedPieces}/{run.totalPieces}
                  </span>
                )}
                <span className="text-green-400">{run.successfulPieces} passed</span>
                {run.failedPieces > 0 && (
                  <span className="text-red-400">{run.failedPieces} failed</span>
                )}
              </div>
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t border-zinc-700/50">
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {recentLogs.slice(0, 5).map((log) => {
                const config = levelConfig[log.level] || levelConfig.info;
                const icon = eventTypeIcons[log.eventType] || config.icon;
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 text-xs py-1"
                  >
                    <span className={cn("mt-0.5 flex-shrink-0", config.color)}>
                      {icon}
                    </span>
                    <span className="text-zinc-300 truncate flex-1">
                      {log.message.length > 60 ? log.message.slice(0, 60) + "..." : log.message}
                    </span>
                    <span className="text-zinc-500 flex-shrink-0">
                      {formatTimestamp(log.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function CriticalIncidentsPanel({ incidents }: { incidents: ActivityLogEntry[] }) {
  if (incidents.length === 0) return null;
  
  return (
    <div className="mx-3 mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-red-400" />
        <span className="text-xs font-medium text-red-400 uppercase">Critical Issues</span>
        <Badge className="h-4 text-xs px-1 bg-red-500/20 text-red-400 border-0">
          {incidents.length}
        </Badge>
      </div>
      <div className="space-y-1 max-h-20 overflow-y-auto">
        {incidents.slice(0, 3).map((log) => (
          <div key={log.id} className="text-xs text-red-300 truncate">
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}

type LogCategory = "all" | "milestone" | "content" | "error";

function EventStream({ 
  logs,
  isPaused,
  onTogglePause,
  isFullScreen,
}: { 
  logs: ActivityLogEntry[];
  isPaused: boolean;
  onTogglePause: () => void;
  isFullScreen: boolean;
}) {
  const [category, setCategory] = useState<LogCategory>("all");
  const [visibleCount, setVisibleCount] = useState(50);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const categorizedLogs = useMemo(() => {
    const categorized: Record<LogCategory, ActivityLogEntry[]> = {
      milestone: [],
      content: [],
      error: [],
      all: logs,
    };
    
    logs.forEach(log => {
      if (log.level === "error" || log.level === "warning") {
        categorized.error.push(log);
      }
      if (log.eventType.includes("run_") || log.eventType.includes("topic")) {
        categorized.milestone.push(log);
      }
      if (log.eventType.includes("content") || log.eventType.includes("video") || log.eventType.includes("image")) {
        categorized.content.push(log);
      }
    });
    
    return categorized;
  }, [logs]);
  
  const displayLogs = useMemo(() => {
    return categorizedLogs[category].slice(0, visibleCount);
  }, [categorizedLogs, category, visibleCount]);
  
  const hasMore = categorizedLogs[category].length > visibleCount;
  
  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs, isPaused]);
  
  const categories: { key: LogCategory; label: string; count: number }[] = [
    { key: "all", label: "All", count: logs.length },
    { key: "milestone", label: "Milestones", count: categorizedLogs.milestone.length },
    { key: "content", label: "Content", count: categorizedLogs.content.length },
    { key: "error", label: "Errors", count: categorizedLogs.error.length },
  ];
  
  const listHeight = isFullScreen ? "h-[300px]" : "h-[200px]";
  
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
        <div className="flex items-center gap-2">
          <Layers className="w-3 h-3 text-zinc-500" />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Events
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {categories.map(cat => (
              <Button
                key={cat.key}
                variant="ghost"
                size="sm"
                onClick={() => setCategory(cat.key)}
                className={cn(
                  "h-5 px-1.5 text-[10px]",
                  category === cat.key 
                    ? "bg-cyan-500/20 text-cyan-400" 
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {cat.label}
                {cat.count > 0 && (
                  <span className="ml-1 text-[9px] opacity-70">({cat.count})</span>
                )}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onTogglePause}
            className="h-6 w-6 p-0 text-zinc-400 hover:text-white"
            data-testid="btn-toggle-autoscroll"
            title={isPaused ? "Resume auto-scroll" : "Pause auto-scroll"}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </Button>
        </div>
      </div>
      
      <ScrollArea className={cn("flex-1", listHeight)} data-testid="list-activity-logs">
        <div ref={scrollRef} className="p-3 space-y-1.5">
          {displayLogs.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No {category === "all" ? "recent" : category} activity</p>
            </div>
          ) : (
            <>
              {displayLogs.map((log) => {
                const config = levelConfig[log.level] || levelConfig.info;
                const icon = eventTypeIcons[log.eventType] || config.icon;
                return (
                  <div
                    key={log.id}
                    className={cn(
                      "p-2 rounded border text-xs transition-all",
                      config.bgColor,
                      "hover:brightness-110"
                    )}
                    data-testid={`text-activity-log-${log.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={cn("mt-0.5 flex-shrink-0", config.color)}>
                        {icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-200 leading-snug break-words line-clamp-2">
                          {log.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-zinc-500">
                            {formatTimestamp(log.createdAt)}
                          </span>
                          <Badge variant="outline" className="h-4 text-[10px] px-1 border-zinc-600 text-zinc-500">
                            {log.eventType.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setVisibleCount(prev => prev + 50)}
                  className="w-full text-xs text-zinc-400 hover:text-white"
                >
                  Load more ({categorizedLogs[category].length - visibleCount} remaining)
                </Button>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function ActivityPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [previousRuns, setPreviousRuns] = useState<Map<string, ActiveRun>>(new Map());

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
    refetchInterval: isExpanded ? 3000 : 15000,
    enabled: true,
  });

  const { data: providersData } = useQuery<ProvidersResponse>({
    queryKey: ["/api/providers/status"],
    queryFn: async () => {
      const res = await fetch("/api/providers/status");
      if (!res.ok) throw new Error("Failed to fetch provider status");
      return res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: contentRuns = [] } = useQuery<{ status: string }[]>({
    queryKey: ["/api/content-runs"],
    queryFn: async () => {
      const res = await fetch("/api/content-runs?limit=50");
      if (!res.ok) throw new Error("Failed to fetch content runs");
      return res.json();
    },
    staleTime: 10000,
  });

  const getClientName = useCallback((clientId: number): string => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || `Client #${clientId}`;
  }, [clients]);

  const queueDepth = useMemo(() => {
    return contentRuns.filter(r => r.status === "running").length;
  }, [contentRuns]);

  const providers = useMemo(() => {
    return providersData?.providers || {};
  }, [providersData]);

  const criticalIncidents = useMemo(() => {
    return pipelineStatus?.recentActivity?.filter(
      log => log.level === "error" && 
      (log.eventType.includes("failed") || log.eventType.includes("error"))
    ) || [];
  }, [pipelineStatus?.recentActivity]);

  const warningCount = useMemo(() => {
    return pipelineStatus?.recentActivity?.filter(log => log.level === "warning").length || 0;
  }, [pipelineStatus?.recentActivity]);

  const runsWithState = useMemo(() => {
    if (!pipelineStatus) return [];
    
    return pipelineStatus.activeRuns.map(run => ({
      run,
      clientName: getClientName(run.clientId),
      lifecycleState: getRunLifecycleState(run, pipelineStatus.recentActivity),
      recentLogs: pipelineStatus.recentActivity.filter(l => l.runId === run.runId).slice(0, 10),
      errorCount: pipelineStatus.recentActivity.filter(
        l => l.runId === run.runId && l.level === "error"
      ).length,
    }));
  }, [pipelineStatus, getClientName]);

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
  }, [pipelineStatus, getClientName]);

  const toggleRunExpansion = useCallback((runId: string) => {
    setExpandedRuns(prev => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  }, []);

  const activeRunCount = pipelineStatus?.activeRuns?.length || 0;
  const isActive = pipelineStatus?.isActive || false;

  const panelWidth = isFullScreen ? "w-[500px]" : "w-96";
  const panelHeight = isFullScreen ? "max-h-[80vh]" : "max-h-[600px]";

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
              className="absolute -top-1 -right-1 h-5 min-w-5 p-0 flex items-center justify-center bg-cyan-500 text-white border-0 text-xs"
              data-testid="badge-active-runs"
            >
              {activeRunCount}
            </Badge>
          )}
          {criticalIncidents.length > 0 && (
            <Badge
              className="absolute -top-1 -left-1 h-4 min-w-4 p-0 flex items-center justify-center bg-red-500 text-white border-0 text-[10px] animate-pulse"
            >
              !
            </Badge>
          )}
          {isActive && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-6 bg-cyan-400 rounded-full animate-pulse" />
          )}
        </Button>
      ) : (
        <div
          className={cn(
            panelWidth,
            panelHeight,
            "rounded-lg shadow-xl border overflow-hidden flex flex-col",
            "bg-zinc-900/95 backdrop-blur-sm border-zinc-700",
            "animate-in slide-in-from-bottom-5 duration-300"
          )}
          data-testid="panel-activity-expanded"
        >
          <div className="flex items-center justify-between p-3 border-b border-zinc-700 bg-zinc-800/50">
            <div className="flex items-center gap-2">
              <Activity className={cn("w-4 h-4", isActive ? "text-cyan-400" : "text-zinc-400")} />
              <h3 className="font-medium text-white text-sm">Pipeline Monitor</h3>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-zinc-700"
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-zinc-700"
                data-testid="panel-activity-toggle"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <GlobalStatusBar
            activeRuns={activeRunCount}
            queueDepth={queueDepth}
            criticalCount={criticalIncidents.length}
            warningCount={warningCount}
            isActive={isActive}
            providers={providers}
          />

          <CriticalIncidentsPanel incidents={criticalIncidents} />

          {runsWithState.length > 0 && (
            <div className="px-3 py-2 space-y-2 border-b border-zinc-700/50 max-h-[200px] overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Active Runs
                </span>
                <TrendingUp className="w-3 h-3 text-zinc-500" />
              </div>
              {runsWithState.map(({ run, clientName, lifecycleState, recentLogs, errorCount }) => (
                <RunCard
                  key={run.runId}
                  run={run}
                  clientName={clientName}
                  lifecycleState={lifecycleState}
                  recentLogs={recentLogs}
                  errorCount={errorCount}
                  isExpanded={expandedRuns.has(run.runId)}
                  onToggle={() => toggleRunExpansion(run.runId)}
                />
              ))}
            </div>
          )}

          <EventStream
            logs={pipelineStatus?.recentActivity || []}
            isPaused={isPaused}
            onTogglePause={() => setIsPaused(!isPaused)}
            isFullScreen={isFullScreen}
          />
        </div>
      )}
    </div>
  );
}
