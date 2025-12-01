import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  Settings,
  Shield,
  TrendingDown,
  TrendingUp,
  Zap,
  TestTube,
  RotateCcw,
  Timer,
  XCircle,
  RefreshCw,
} from "lucide-react";

interface RemediationRule {
  id: number;
  ruleId: string;
  name: string;
  description: string;
  triggerType: string;
  triggerConditions: string;
  actionType: string;
  actionParams: string | null;
  mode: string;
  requiresApproval: boolean;
  cooldownMinutes: number;
  maxExecutionsPerHour: number | null;
  priority: number;
  isActive: boolean;
}

interface RemediationExecution {
  id: number;
  executionId: string;
  ruleId: string;
  providerName: string | null;
  serviceType: string | null;
  failureDetectedAt: string;
  remediationStartedAt: string | null;
  remediationCompletedAt: string | null;
  mttdSeconds: number | null;
  mttrSeconds: number | null;
  actionTaken: string;
  status: string;
  wasSuccessful: boolean | null;
  errorMessage: string | null;
  createdAt: string;
}

interface FailureSimulation {
  id: number;
  simulationId: string;
  name: string;
  description: string | null;
  targetProvider: string | null;
  failureType: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  scheduledDurationMinutes: number;
  detectionTimeSeconds: number | null;
  remediationTimeSeconds: number | null;
  passedDetection: boolean | null;
  passedRemediation: boolean | null;
  overallScore: string | null;
}

interface HealingMetrics {
  current: {
    avgMttd: number;
    avgMttr: number;
    failureRate: number;
    successRate: number;
  };
  trend: {
    mttdChange: number;
    mttrChange: number;
    failureRateChange: number;
  };
  byProvider: Array<{
    provider: string;
    mttd: number;
    mttr: number;
    failures: number;
  }>;
}

export default function SelfHealingPage() {
  const queryClient = useQueryClient();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [newSimName, setNewSimName] = useState("");
  const [newSimProvider, setNewSimProvider] = useState("");
  const [newSimFailureType, setNewSimFailureType] = useState("rate_limit");
  const [newSimDuration, setNewSimDuration] = useState("5");

  const { data: rules = [] } = useQuery<RemediationRule[]>({
    queryKey: ["/api/remediation/rules"],
  });

  const { data: pending = [] } = useQuery<RemediationExecution[]>({
    queryKey: ["/api/remediation/pending"],
    refetchInterval: 5000,
  });

  const { data: executions = [] } = useQuery<RemediationExecution[]>({
    queryKey: ["/api/remediation/executions"],
    refetchInterval: 5000,
  });

  const { data: metrics } = useQuery<HealingMetrics>({
    queryKey: ["/api/remediation/metrics"],
    refetchInterval: 10000,
  });

  const { data: simulations = [] } = useQuery<FailureSimulation[]>({
    queryKey: ["/api/remediation/simulations"],
    refetchInterval: 5000,
  });

  const { data: activeSimulation } = useQuery<{ active: boolean; simulation: any }>({
    queryKey: ["/api/remediation/simulations/active"],
    refetchInterval: 2000,
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      const response = await fetch(`/api/remediation/rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/remediation/rules"] }),
  });

  const approveMutation = useMutation({
    mutationFn: async (executionId: string) => {
      const response = await fetch(`/api/remediation/pending/${executionId}/approve`, {
        method: "POST",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/remediation/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation/executions"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (executionId: string) => {
      const response = await fetch(`/api/remediation/pending/${executionId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected by user" }),
      });
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/remediation/pending"] }),
  });

  const toggleMonitoringMutation = useMutation({
    mutationFn: async (start: boolean) => {
      const response = await fetch(`/api/remediation/monitoring/${start ? "start" : "stop"}`, {
        method: "POST",
      });
      return response.json();
    },
    onSuccess: (_, start) => setIsMonitoring(start),
  });

  const startSimulationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/remediation/simulations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSimName || "Test Simulation",
          targetProvider: newSimProvider || undefined,
          failureType: newSimFailureType,
          failureParams: { error_rate: 0.8 },
          durationMinutes: parseInt(newSimDuration),
        }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/remediation/simulations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation/simulations/active"] });
      setNewSimName("");
    },
  });

  const stopSimulationMutation = useMutation({
    mutationFn: async (simulationId: string) => {
      const response = await fetch(`/api/remediation/simulations/${simulationId}/stop`, {
        method: "POST",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/remediation/simulations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation/simulations/active"] });
    },
  });

  const formatSeconds = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return "-";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Success</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">In Progress</Badge>;
      case "running":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Running</Badge>;
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Completed</Badge>;
      default:
        return <Badge className="bg-zinc-500/20 text-zinc-400">{status}</Badge>;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "restart_provider":
        return <RefreshCw className="w-4 h-4" />;
      case "rotate_to_fallback":
        return <RotateCcw className="w-4 h-4" />;
      case "quarantine_provider":
        return <Shield className="w-4 h-4" />;
      case "scale_cooldown":
        return <Timer className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
              <Shield className="w-7 h-7 text-cyan-400" />
              Self-Healing Dashboard
            </h1>
            <p className="text-zinc-400 mt-1">
              Automated remediation with MTTD/MTTR tracking
            </p>
          </div>
          <div className="flex items-center gap-4">
            {activeSimulation?.active && (
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse">
                <TestTube className="w-3 h-3 mr-1" />
                Simulation Active
              </Badge>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Auto-Monitoring</span>
              <Switch
                checked={isMonitoring}
                onCheckedChange={(checked) => toggleMonitoringMutation.mutate(checked)}
                data-testid="switch-monitoring"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Avg MTTD</p>
                  <p className="text-2xl font-bold text-white" data-testid="metric-mttd">
                    {formatSeconds(metrics?.current.avgMttd || 0)}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-cyan-500/50" />
              </div>
              {metrics?.trend?.mttdChange !== 0 && metrics && (
                <div className={`flex items-center gap-1 mt-2 text-xs ${metrics.trend.mttdChange < 0 ? "text-green-400" : "text-red-400"}`}>
                  {metrics.trend.mttdChange < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {Math.abs(metrics.trend.mttdChange * 100).toFixed(1)}%
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Avg MTTR</p>
                  <p className="text-2xl font-bold text-white" data-testid="metric-mttr">
                    {formatSeconds(metrics?.current.avgMttr || 0)}
                  </p>
                </div>
                <Timer className="w-8 h-8 text-green-500/50" />
              </div>
              {metrics?.trend?.mttrChange !== 0 && metrics && (
                <div className={`flex items-center gap-1 mt-2 text-xs ${metrics.trend.mttrChange < 0 ? "text-green-400" : "text-red-400"}`}>
                  {metrics.trend.mttrChange < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {Math.abs(metrics.trend.mttrChange * 100).toFixed(1)}%
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Success Rate</p>
                  <p className="text-2xl font-bold text-white" data-testid="metric-success">
                    {((metrics?.current.successRate || 0) * 100).toFixed(1)}%
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Failure Rate</p>
                  <p className="text-2xl font-bold text-white" data-testid="metric-failure">
                    {((metrics?.current.failureRate || 0) * 100).toFixed(2)}%
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="rules" className="space-y-4">
          <TabsList className="bg-zinc-800/50">
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="pending">
              Pending
              {pending.length > 0 && (
                <Badge className="ml-2 bg-yellow-500/20 text-yellow-400">{pending.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="simulations">Simulations</TabsTrigger>
          </TabsList>

          <TabsContent value="rules">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Remediation Rules
                </CardTitle>
                <CardDescription>Configure automatic healing behavior</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {rules.map((rule) => {
                      const conditions = JSON.parse(rule.triggerConditions || "{}");
                      return (
                        <div
                          key={rule.ruleId}
                          className={`p-4 rounded-lg border ${rule.isActive ? "bg-zinc-800/50 border-zinc-700" : "bg-zinc-900/50 border-zinc-800 opacity-60"}`}
                          data-testid={`rule-${rule.ruleId}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getActionIcon(rule.actionType)}
                              <div>
                                <h4 className="font-medium text-white">{rule.name}</h4>
                                <p className="text-sm text-zinc-400">{rule.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right text-sm">
                                <div className="text-zinc-400">
                                  {rule.mode === "auto" ? (
                                    <Badge className="bg-green-500/20 text-green-400">Auto</Badge>
                                  ) : rule.mode === "semi_auto" ? (
                                    <Badge className="bg-yellow-500/20 text-yellow-400">Semi-Auto</Badge>
                                  ) : (
                                    <Badge className="bg-zinc-500/20 text-zinc-400">Manual</Badge>
                                  )}
                                </div>
                                <div className="text-zinc-500 mt-1">
                                  Cooldown: {rule.cooldownMinutes}m
                                  {conditions.threshold && ` | Threshold: ${(conditions.threshold * 100).toFixed(0)}%`}
                                </div>
                              </div>
                              <Switch
                                checked={rule.isActive}
                                onCheckedChange={(checked) => 
                                  toggleRuleMutation.mutate({ ruleId: rule.ruleId, isActive: checked })
                                }
                                data-testid={`switch-rule-${rule.ruleId}`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  Pending Approvals
                </CardTitle>
                <CardDescription>Remediations awaiting your approval</CardDescription>
              </CardHeader>
              <CardContent>
                {pending.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    No pending remediations
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {pending.map((exec) => (
                        <div
                          key={exec.executionId}
                          className="p-4 rounded-lg border bg-yellow-500/5 border-yellow-500/30"
                          data-testid={`pending-${exec.executionId}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                {getActionIcon(exec.actionTaken)}
                                <span className="font-medium">{exec.actionTaken.replace(/_/g, " ")}</span>
                                {exec.providerName && (
                                  <Badge variant="outline">{exec.providerName}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-zinc-400 mt-1">
                                Detected: {new Date(exec.failureDetectedAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                onClick={() => rejectMutation.mutate(exec.executionId)}
                                data-testid={`reject-${exec.executionId}`}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => approveMutation.mutate(exec.executionId)}
                                data-testid={`approve-${exec.executionId}`}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Execution History
                </CardTitle>
                <CardDescription>Recent remediation actions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {executions.map((exec) => (
                      <div
                        key={exec.executionId}
                        className="p-3 rounded-lg border bg-zinc-800/50 border-zinc-700"
                        data-testid={`execution-${exec.executionId}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getActionIcon(exec.actionTaken)}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  {exec.actionTaken.replace(/_/g, " ")}
                                </span>
                                {exec.providerName && (
                                  <Badge variant="outline" className="text-xs">
                                    {exec.providerName}
                                  </Badge>
                                )}
                                {getStatusBadge(exec.status)}
                              </div>
                              <p className="text-xs text-zinc-500 mt-1">
                                {new Date(exec.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-zinc-400">
                              MTTD: {formatSeconds(exec.mttdSeconds)}
                            </div>
                            <div className="text-zinc-500">
                              MTTR: {formatSeconds(exec.mttrSeconds)}
                            </div>
                          </div>
                        </div>
                        {exec.errorMessage && (
                          <p className="text-xs text-red-400 mt-2 truncate">
                            {exec.errorMessage}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="simulations">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TestTube className="w-5 h-5 text-purple-400" />
                    Run Simulation
                  </CardTitle>
                  <CardDescription>Test self-healing with controlled failures</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-zinc-400">Simulation Name</label>
                    <Input
                      value={newSimName}
                      onChange={(e) => setNewSimName(e.target.value)}
                      placeholder="e.g., Rate Limit Test"
                      className="bg-zinc-800 border-zinc-700 mt-1"
                      data-testid="input-sim-name"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400">Target Provider (optional)</label>
                    <Input
                      value={newSimProvider}
                      onChange={(e) => setNewSimProvider(e.target.value)}
                      placeholder="e.g., runway"
                      className="bg-zinc-800 border-zinc-700 mt-1"
                      data-testid="input-sim-provider"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400">Failure Type</label>
                    <Select value={newSimFailureType} onValueChange={setNewSimFailureType}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 mt-1" data-testid="select-failure-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rate_limit">Rate Limit (429)</SelectItem>
                        <SelectItem value="network_timeout">Network Timeout</SelectItem>
                        <SelectItem value="api_error">API Error (500)</SelectItem>
                        <SelectItem value="provider_outage">Provider Outage</SelectItem>
                        <SelectItem value="data_corruption">Data Corruption</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400">Duration (minutes)</label>
                    <Input
                      type="number"
                      value={newSimDuration}
                      onChange={(e) => setNewSimDuration(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 mt-1"
                      min="1"
                      max="30"
                      data-testid="input-sim-duration"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => startSimulationMutation.mutate()}
                    disabled={activeSimulation?.active}
                    data-testid="button-start-simulation"
                  >
                    {activeSimulation?.active ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Simulation Running
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Simulation
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle>Simulation History</CardTitle>
                  <CardDescription>Past simulation results</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {simulations.map((sim) => (
                        <div
                          key={sim.simulationId}
                          className="p-3 rounded-lg border bg-zinc-800/50 border-zinc-700"
                          data-testid={`simulation-${sim.simulationId}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{sim.name}</span>
                                {getStatusBadge(sim.status)}
                              </div>
                              <p className="text-xs text-zinc-500">
                                {sim.failureType} | {sim.scheduledDurationMinutes}m
                              </p>
                            </div>
                            {sim.status === "running" ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => stopSimulationMutation.mutate(sim.simulationId)}
                                data-testid={`stop-sim-${sim.simulationId}`}
                              >
                                Stop
                              </Button>
                            ) : sim.overallScore && (
                              <div className="text-right">
                                <div className={`text-lg font-bold ${
                                  parseFloat(sim.overallScore) >= 75 ? "text-green-400" :
                                  parseFloat(sim.overallScore) >= 50 ? "text-yellow-400" : "text-red-400"
                                }`}>
                                  {sim.overallScore}%
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {sim.passedDetection ? "Detection" : ""}{sim.passedDetection && sim.passedRemediation ? " + " : ""}{sim.passedRemediation ? "Remediation" : ""}
                                </div>
                              </div>
                            )}
                          </div>
                          {sim.status === "completed" && (
                            <div className="mt-2 pt-2 border-t border-zinc-700 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-zinc-500">Detection:</span>{" "}
                                <span className={sim.passedDetection ? "text-green-400" : "text-red-400"}>
                                  {formatSeconds(sim.detectionTimeSeconds)}
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500">Recovery:</span>{" "}
                                <span className={sim.passedRemediation ? "text-green-400" : "text-red-400"}>
                                  {formatSeconds(sim.remediationTimeSeconds)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {metrics?.byProvider && metrics.byProvider.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle>Provider Metrics</CardTitle>
              <CardDescription>MTTD/MTTR by provider (last 24h)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {metrics.byProvider.map((p) => (
                  <div
                    key={p.provider}
                    className="p-3 rounded-lg border bg-zinc-800/50 border-zinc-700"
                    data-testid={`provider-metric-${p.provider}`}
                  >
                    <div className="font-medium text-white mb-2">{p.provider}</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-zinc-500">MTTD</span>
                        <div className="text-cyan-400">{formatSeconds(p.mttd)}</div>
                      </div>
                      <div>
                        <span className="text-zinc-500">MTTR</span>
                        <div className="text-green-400">{formatSeconds(p.mttr)}</div>
                      </div>
                      <div>
                        <span className="text-zinc-500">Failures</span>
                        <div className="text-red-400">{p.failures}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
