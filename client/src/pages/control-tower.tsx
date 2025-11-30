import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { 
  Power,
  PowerOff,
  Video, 
  Image,
  Mic,
  Brain,
  Zap,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ArrowLeft,
  Loader2,
  Activity,
  History
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ControlEntity = {
  id: number;
  slug: string;
  type: string;
  displayName: string;
  description: string | null;
  category: string;
  isEnabled: boolean;
  dependsOn: string | null;
  priority: number;
  lastChangedBy: string | null;
  changedAt: string;
  createdAt: string;
};

type ControlEvent = {
  id: number;
  entitySlug: string;
  action: string;
  previousState: boolean | null;
  newState: boolean | null;
  triggeredBy: string | null;
  reason: string | null;
  metadata: string | null;
  createdAt: string;
};

type ControlCenterResponse = {
  entities: ControlEntity[];
  recentEvents: ControlEvent[];
};

type ControlStatus = {
  operational: boolean;
  masterEnabled: boolean;
  categoryStatus: {
    master: boolean;
    video: boolean;
    audio: boolean;
    content: boolean;
    image: boolean;
  };
  totalEntities: number;
  enabledEntities: number;
  disabledEntities: number;
};

const categoryIcons: Record<string, React.ReactNode> = {
  master: <Shield className="w-5 h-5" />,
  video: <Video className="w-5 h-5" />,
  audio: <Mic className="w-5 h-5" />,
  content: <Brain className="w-5 h-5" />,
  image: <Image className="w-5 h-5" />,
};

const categoryLabels: Record<string, string> = {
  master: "Master Control",
  video: "Video Pipeline",
  audio: "Audio Pipeline",
  content: "Content Pipeline",
  image: "Image Pipeline",
};

const categoryDescriptions: Record<string, string> = {
  master: "Global system kill switch - disables all operations",
  video: "Video generation providers and orchestration",
  audio: "Voice synthesis and audio generation",
  content: "Content generation agents and workflows",
  image: "Image generation providers",
};

const typeColors: Record<string, string> = {
  global: "bg-red-500/20 text-red-400 border-red-500/30",
  pipeline: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  agent: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  provider: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  script: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const actionColors: Record<string, string> = {
  enabled: "text-green-400",
  disabled: "text-red-400",
  kill: "text-red-500",
  reset: "text-green-500",
};

export default function ControlTower() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: controlData, isLoading } = useQuery<ControlCenterResponse>({
    queryKey: ["/api/control-center"],
    queryFn: async () => {
      const res = await fetch("/api/control-center");
      if (!res.ok) throw new Error("Failed to fetch control center");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: status } = useQuery<ControlStatus>({
    queryKey: ["/api/control-center/status"],
    queryFn: async () => {
      const res = await fetch("/api/control-center/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ slug, isEnabled }: { slug: string; isEnabled: boolean }) => {
      const res = await fetch(`/api/control-center/${slug}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/control-center"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control-center/status"] });
      toast({
        title: variables.isEnabled ? "Service Enabled" : "Service Disabled",
        description: `${variables.slug} has been ${variables.isEnabled ? "enabled" : "disabled"}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const killMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/control-center/global/kill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggeredBy: "user" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/control-center"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control-center/status"] });
      toast({
        title: "EMERGENCY STOP ACTIVATED",
        description: `All ${data.entities?.length || 0} services disabled. ${data.cancelledProjects || 0} projects cancelled.`,
        variant: "destructive",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Kill Switch Failed", description: error.message, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/control-center/global/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggeredBy: "user" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/control-center"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control-center/status"] });
      toast({
        title: "All Services Reset",
        description: `All ${data.entities?.length || 0} services have been enabled`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Reset Failed", description: error.message, variant: "destructive" });
    },
  });

  const entities = controlData?.entities || [];
  const events = controlData?.recentEvents || [];

  const groupedEntities = entities.reduce((acc, entity) => {
    if (!acc[entity.category]) acc[entity.category] = [];
    acc[entity.category].push(entity);
    return acc;
  }, {} as Record<string, ControlEntity[]>);

  const categoryOrder = ["master", "video", "audio", "content", "image"];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100" data-testid="button-back">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div className="h-6 w-px bg-zinc-700" />
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30">
                  <Shield className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-zinc-100">Control Tower</h1>
                  <p className="text-sm text-zinc-500">System-wide agent & service controls</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {status && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700">
                  {status.operational ? (
                    <>
                      <Activity className="w-4 h-4 text-green-400 animate-pulse" />
                      <span className="text-sm text-green-400 font-medium" data-testid="status-operational">OPERATIONAL</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-red-400 font-medium" data-testid="status-halted">SYSTEM HALTED</span>
                    </>
                  )}
                </div>
              )}
              <Link href="/settings">
                <Button variant="outline" size="sm" className="border-zinc-700" data-testid="button-settings">
                  Provider Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-gradient-to-br from-red-950/30 to-zinc-900 border-red-500/30 mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-red-500/20 border-2 border-red-500/50">
                  <AlertTriangle className="w-10 h-10 text-red-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-100">Emergency Controls</h2>
                  <p className="text-zinc-400 mt-1">
                    Master kill switch stops all generation, cancels in-flight jobs
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-green-500/50 text-green-400 hover:bg-green-500/20 hover:text-green-300 px-8"
                  onClick={() => resetMutation.mutate()}
                  disabled={resetMutation.isPending}
                  data-testid="button-reset-all"
                >
                  {resetMutation.isPending ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Power className="w-5 h-5 mr-2" />
                  )}
                  Reset All
                </Button>
                <Button
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 text-white px-8 shadow-lg shadow-red-500/25"
                  onClick={() => {
                    if (confirm("Are you sure you want to STOP ALL SERVICES? This will cancel any in-progress generation.")) {
                      killMutation.mutate();
                    }
                  }}
                  disabled={killMutation.isPending}
                  data-testid="button-kill-all"
                >
                  {killMutation.isPending ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <PowerOff className="w-5 h-5 mr-2" />
                  )}
                  KILL ALL
                </Button>
              </div>
            </div>

            {status && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-red-500/20">
                <div className="text-center">
                  <div className="text-2xl font-bold text-zinc-100" data-testid="stat-total">{status.totalEntities}</div>
                  <div className="text-xs text-zinc-500">Total Services</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400" data-testid="stat-enabled">{status.enabledEntities}</div>
                  <div className="text-xs text-zinc-500">Enabled</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400" data-testid="stat-disabled">{status.disabledEntities}</div>
                  <div className="text-xs text-zinc-500">Disabled</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${status.categoryStatus.video ? "text-green-400" : "text-red-400"}`}>
                    {status.categoryStatus.video ? "ON" : "OFF"}
                  </div>
                  <div className="text-xs text-zinc-500">Video</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${status.categoryStatus.content ? "text-green-400" : "text-red-400"}`}>
                    {status.categoryStatus.content ? "ON" : "OFF"}
                  </div>
                  <div className="text-xs text-zinc-500">Content</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {categoryOrder.map((category) => {
            const categoryEntities = groupedEntities[category] || [];
            if (categoryEntities.length === 0) return null;

            const isMaster = category === "master";
            const allEnabled = categoryEntities.every((e) => e.isEnabled);
            const someEnabled = categoryEntities.some((e) => e.isEnabled);

            return (
              <Card
                key={category}
                className={`${
                  isMaster
                    ? "lg:col-span-2 bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-700"
                    : "bg-zinc-900/50 border-zinc-800"
                }`}
                data-testid={`card-category-${category}`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isMaster
                            ? "bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30"
                            : "bg-zinc-800 border border-zinc-700"
                        }`}
                      >
                        {categoryIcons[category]}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{categoryLabels[category]}</CardTitle>
                        <CardDescription className="text-zinc-500">
                          {categoryDescriptions[category]}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`${
                        allEnabled
                          ? "border-green-500/50 text-green-400"
                          : someEnabled
                          ? "border-yellow-500/50 text-yellow-400"
                          : "border-red-500/50 text-red-400"
                      }`}
                    >
                      {allEnabled ? "All Active" : someEnabled ? "Partial" : "All Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {categoryEntities
                    .sort((a, b) => a.priority - b.priority)
                    .map((entity) => (
                      <div
                        key={entity.slug}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          entity.isEnabled
                            ? "bg-zinc-800/50 border border-zinc-700"
                            : "bg-zinc-900/50 border border-zinc-800"
                        }`}
                        data-testid={`toggle-row-${entity.slug}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              entity.isEnabled ? "bg-green-400" : "bg-red-400"
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-zinc-200">
                                {entity.displayName}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-xs ${typeColors[entity.type]}`}
                              >
                                {entity.type}
                              </Badge>
                            </div>
                            {entity.changedAt && (
                              <div className="flex items-center gap-1 mt-0.5 text-xs text-zinc-500">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(entity.changedAt), {
                                  addSuffix: true,
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <Switch
                          checked={entity.isEnabled}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ slug: entity.slug, isEnabled: checked })
                          }
                          disabled={toggleMutation.isPending}
                          data-testid={`switch-${entity.slug}`}
                        />
                      </div>
                    ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                <History className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Audit Log</CardTitle>
                <CardDescription className="text-zinc-500">
                  Recent control center events
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {events.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  No events recorded yet
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30 border border-zinc-800"
                      data-testid={`event-row-${event.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {event.action === "enabled" || event.action === "reset" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <div>
                          <span className={`font-medium ${actionColors[event.action] || "text-zinc-300"}`}>
                            {event.action.toUpperCase()}
                          </span>
                          <span className="text-zinc-400 ml-2">{event.entitySlug}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-zinc-500">
                        <span>{event.triggeredBy || "system"}</span>
                        <span>
                          {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
