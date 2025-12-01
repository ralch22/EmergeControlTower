import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  DollarSign,
  Shield,
  TrendingUp,
  Video,
  Image,
  Mic,
  MessageSquare,
  Brain,
  History,
} from "lucide-react";

type ProviderHealth = {
  providerName: string;
  serviceType: string;
  isHealthy: boolean;
  healthScore: number;
  successRate: number;
  avgLatencyMs: number;
  rateLimitActive: boolean;
  lastError?: string;
  priority: number;
  isFreeProvider: boolean;
};

type HealingAction = {
  providerName: string;
  actionType: string;
  reason: string;
  triggeredBy: string;
  createdAt: string;
};

const serviceTypeIcons: Record<string, React.ReactNode> = {
  video: <Video className="w-4 h-4" />,
  image: <Image className="w-4 h-4" />,
  audio: <Mic className="w-4 h-4" />,
  text: <MessageSquare className="w-4 h-4" />,
};

const serviceTypeColors: Record<string, string> = {
  video: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  image: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  audio: "bg-green-500/20 text-green-400 border-green-500/30",
  text: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export default function ProviderHealth() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: healthResponse, isLoading: isLoadingHealth } = useQuery<{
    providers: ProviderHealth[];
    summary: {
      total: number;
      healthy: number;
      unhealthy: number;
      rateLimited: number;
      freeProvidersAvailable: number;
      avgHealthScore: number;
    };
  }>({
    queryKey: ["/api/providers/health"],
    refetchInterval: 10000,
  });
  
  const healthData = healthResponse?.providers;

  const { data: smartOrder } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/providers/smart-order"],
    refetchInterval: 15000,
  });

  const { data: healingActions, isLoading: isLoadingActions } = useQuery<HealingAction[]>({
    queryKey: ["/api/providers/healing-actions"],
    refetchInterval: 30000,
  });

  const resetRateLimitsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/providers/reset-rate-limits", { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset rate limits");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers/health"] });
      toast({ title: "Rate limits reset", description: "All provider rate limits have been cleared." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reset rate limits", variant: "destructive" });
    },
  });

  const recalculatePrioritiesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/providers/recalculate-priorities", { method: "POST" });
      if (!res.ok) throw new Error("Failed to recalculate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/providers/smart-order"] });
      toast({ title: "Priorities recalculated", description: "Provider priorities have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to recalculate priorities", variant: "destructive" });
    },
  });

  const providers = healthData || [];
  const actions = healingActions || [];

  const healthyCount = providers.filter(p => p.isHealthy).length;
  const rateLimitedCount = providers.filter(p => p.rateLimitActive).length;
  const avgHealthScore = providers.length > 0 
    ? providers.reduce((acc, p) => acc + p.healthScore, 0) / providers.length 
    : 0;
  const freeProviders = providers.filter(p => p.isFreeProvider);

  const groupedProviders = providers.reduce((acc, p) => {
    if (!acc[p.serviceType]) acc[p.serviceType] = [];
    acc[p.serviceType].push(p);
    return acc;
  }, {} as Record<string, ProviderHealth[]>);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const getActionIcon = (actionType: string) => {
    if (actionType.includes("rate_limit")) return <Clock className="w-4 h-4 text-orange-400" />;
    if (actionType.includes("error")) return <AlertTriangle className="w-4 h-4 text-red-400" />;
    if (actionType.includes("priority")) return <TrendingUp className="w-4 h-4 text-cyan-400" />;
    return <Brain className="w-4 h-4 text-purple-400" />;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="w-8 h-8 text-cyan-400" />
              Provider Health Monitor
            </h1>
            <p className="text-zinc-400 mt-1">ML-powered self-healing system for automatic provider management</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => recalculatePrioritiesMutation.mutate()}
              disabled={recalculatePrioritiesMutation.isPending}
              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
              data-testid="button-recalculate"
            >
              {recalculatePrioritiesMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Recalculate Priorities
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetRateLimitsMutation.mutate()}
              disabled={resetRateLimitsMutation.isPending}
              className="border-orange-500/30 text-orange-400 hover:bg-orange-500/20"
              data-testid="button-reset-limits"
            >
              {resetRateLimitsMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              Reset Rate Limits
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Healthy Providers</p>
                  <p className="text-3xl font-bold text-green-400">{healthyCount}</p>
                  <p className="text-xs text-zinc-500">of {providers.length} total</p>
                </div>
                <CheckCircle2 className="w-10 h-10 text-green-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Avg Health Score</p>
                  <p className="text-3xl font-bold text-cyan-400">{avgHealthScore.toFixed(0)}%</p>
                  <Progress value={avgHealthScore} className="h-1 mt-2 w-24" />
                </div>
                <Activity className="w-10 h-10 text-cyan-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Rate Limited</p>
                  <p className="text-3xl font-bold text-orange-400">{rateLimitedCount}</p>
                  <p className="text-xs text-zinc-500">cooling down</p>
                </div>
                <Clock className="w-10 h-10 text-orange-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Free Tier Active</p>
                  <p className="text-3xl font-bold text-purple-400">{freeProviders.filter(p => p.isHealthy).length}</p>
                  <p className="text-xs text-zinc-500">of {freeProviders.length} free</p>
                </div>
                <DollarSign className="w-10 h-10 text-purple-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="border-b border-zinc-800">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Provider Status by Service Type
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="bg-zinc-800/50 mb-4">
                    <TabsTrigger value="all" className="data-[state=active]:bg-zinc-700">All</TabsTrigger>
                    <TabsTrigger value="video" className="data-[state=active]:bg-purple-600">Video</TabsTrigger>
                    <TabsTrigger value="image" className="data-[state=active]:bg-cyan-600">Image</TabsTrigger>
                    <TabsTrigger value="audio" className="data-[state=active]:bg-green-600">Audio</TabsTrigger>
                    <TabsTrigger value="text" className="data-[state=active]:bg-yellow-600">Text</TabsTrigger>
                  </TabsList>

                  <TabsContent value="all">
                    {isLoadingHealth ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(groupedProviders).map(([type, typeProviders]) => (
                          <div key={type}>
                            <div className="flex items-center gap-2 mb-3">
                              <Badge className={serviceTypeColors[type]}>
                                {serviceTypeIcons[type]}
                                <span className="ml-1 capitalize">{type}</span>
                              </Badge>
                              <span className="text-xs text-zinc-500">
                                {typeProviders.filter(p => p.isHealthy).length}/{typeProviders.length} healthy
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {typeProviders.map((provider) => (
                                <ProviderCard key={provider.providerName} provider={provider} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {["video", "image", "audio", "text"].map((type) => (
                    <TabsContent key={type} value={type}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(groupedProviders[type] || []).map((provider) => (
                          <ProviderCard key={provider.providerName} provider={provider} />
                        ))}
                        {(!groupedProviders[type] || groupedProviders[type].length === 0) && (
                          <div className="col-span-2 text-center py-8 text-zinc-500">
                            No {type} providers configured
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

            {smartOrder && (
              <Card className="bg-zinc-900/50 border-zinc-800 mt-6">
                <CardHeader className="border-b border-zinc-800">
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                    Smart Provider Order (ML-Optimized)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(smartOrder).map(([type, order]) => (
                      <div key={type} className="space-y-2">
                        <Badge className={serviceTypeColors[type]}>
                          {serviceTypeIcons[type]}
                          <span className="ml-1 capitalize">{type}</span>
                        </Badge>
                        <div className="space-y-1">
                          {order.map((name, idx) => (
                            <div key={name} className="flex items-center gap-2 text-sm">
                              <span className="text-zinc-500 font-mono w-4">{idx + 1}.</span>
                              <span className="text-zinc-300">{name.replace(/_/g, " ")}</span>
                            </div>
                          ))}
                          {order.length === 0 && (
                            <span className="text-xs text-zinc-500">No healthy providers</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <Card className="bg-zinc-900/50 border-zinc-800 h-full">
              <CardHeader className="border-b border-zinc-800">
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan-400" />
                  Recent Healing Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  {isLoadingActions ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    </div>
                  ) : actions.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                      <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No healing actions yet</p>
                      <p className="text-xs mt-1">System will log actions automatically</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800">
                      {actions.map((action, idx) => (
                        <div key={idx} className="p-4 hover:bg-zinc-800/50">
                          <div className="flex items-start gap-3">
                            {getActionIcon(action.actionType)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-white">
                                  {action.providerName.replace(/_/g, " ")}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {action.actionType.replace(/_/g, " ")}
                                </Badge>
                              </div>
                              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                                {action.reason}
                              </p>
                              <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                                <span>{formatTime(action.createdAt)}</span>
                                <span>•</span>
                                <span>{action.triggeredBy}</span>
                              </div>
                            </div>
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
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderHealth }) {
  const healthColor = provider.healthScore >= 80 
    ? "text-green-400" 
    : provider.healthScore >= 50 
      ? "text-yellow-400" 
      : "text-red-400";

  return (
    <div
      className={`p-4 rounded-lg border ${
        provider.rateLimitActive 
          ? "bg-orange-500/10 border-orange-500/30" 
          : provider.isHealthy 
            ? "bg-zinc-800/50 border-zinc-700" 
            : "bg-red-500/10 border-red-500/30"
      }`}
      data-testid={`provider-card-${provider.providerName}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{provider.providerName.replace(/_/g, " ")}</span>
          {provider.isFreeProvider && (
            <Badge variant="outline" className="text-xs bg-purple-500/20 border-purple-500/30 text-purple-400">
              FREE
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {provider.rateLimitActive ? (
            <Clock className="w-4 h-4 text-orange-400" />
          ) : provider.isHealthy ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Health Score</span>
          <span className={healthColor}>{provider.healthScore.toFixed(0)}%</span>
        </div>
        <Progress 
          value={provider.healthScore} 
          className={`h-1.5 ${provider.healthScore >= 80 ? "[&>div]:bg-green-500" : provider.healthScore >= 50 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"}`}
        />

        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div>
            <span className="text-zinc-500">Success Rate</span>
            <p className="text-white">{provider.successRate.toFixed(1)}%</p>
          </div>
          <div>
            <span className="text-zinc-500">Avg Latency</span>
            <p className="text-white">{provider.avgLatencyMs.toFixed(0)}ms</p>
          </div>
          <div>
            <span className="text-zinc-500">Priority</span>
            <p className="text-white">{provider.priority}</p>
          </div>
          <div>
            <span className="text-zinc-500">Status</span>
            <p className={provider.rateLimitActive ? "text-orange-400" : provider.isHealthy ? "text-green-400" : "text-red-400"}>
              {provider.rateLimitActive ? "Rate Limited" : provider.isHealthy ? "Healthy" : "Unhealthy"}
            </p>
          </div>
        </div>

        {provider.lastError && !provider.isHealthy && (
          <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-300 line-clamp-2">
            {provider.lastError}
          </div>
        )}
      </div>
    </div>
  );
}
