import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  FileText,
  LayoutDashboard,
  Settings,
  Video,
  Eye,
  RefreshCw,
  Film,
  Layers,
  Trash2,
  DollarSign,
  TrendingUp,
  Zap,
  Users,
  AlertTriangle,
  Bell,
  Calendar,
  ArrowRight,
  Activity,
  Shield
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

type ApprovalItem = {
  id: number;
  client: string;
  type: string;
  author: string;
  thumbnail: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
};

type VideoProject = {
  projectId: string;
  title: string;
  description?: string;
  status: string;
  totalDuration?: number;
  outputUrl?: string;
  createdAt: string;
  scenes: Array<{
    sceneId: string;
    sceneNumber: number;
    title: string;
    status: string;
    duration: number;
  }>;
  clips: Array<{
    clipId: string;
    sceneId: string;
    status: string;
    videoUrl?: string;
  }>;
  audioTracks: Array<{
    trackId: string;
    sceneId: string;
    status: string;
    audioUrl?: string;
  }>;
};

type Kpi = {
  id: number;
  mrr: string;
  mrrChange: string;
  profitToday: string;
  aiOutputToday: number;
  activePods: number;
  totalPods: number;
  updatedAt: string;
};

type Alert = {
  id: number;
  title: string;
  description: string;
  severity: string;
  isResolved: boolean;
  createdAt: string;
};

type Pod = {
  id: number;
  name: string;
  vertical: string;
  mrr: string;
  health: number;
  margin: number;
  isActive: boolean;
  createdAt: string;
};

type PhaseChange = {
  id: number;
  client: string;
  oldPrice: string;
  newPrice: string;
  changeDate: string;
  isCompleted: boolean;
  createdAt: string;
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { 
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", 
    icon: <Clock className="w-3 h-3" />,
    label: "Pending"
  },
  approved: { 
    color: "bg-green-500/20 text-green-400 border-green-500/30", 
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: "Approved"
  },
  rejected: { 
    color: "bg-red-500/20 text-red-400 border-red-500/30", 
    icon: <XCircle className="w-3 h-3" />,
    label: "Rejected"
  },
};

const videoStatusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { 
    color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", 
    icon: <Clock className="w-3 h-3" />,
    label: "Draft"
  },
  pending: { 
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", 
    icon: <Clock className="w-3 h-3" />,
    label: "Pending"
  },
  generating: { 
    color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", 
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    label: "Generating"
  },
  processing: { 
    color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", 
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    label: "Processing"
  },
  ready: { 
    color: "bg-green-500/20 text-green-400 border-green-500/30", 
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: "Complete"
  },
  exported: { 
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30", 
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: "Exported"
  },
  failed: { 
    color: "bg-red-500/20 text-red-400 border-red-500/30", 
    icon: <XCircle className="w-3 h-3" />,
    label: "Failed"
  },
};

const severityConfig: Record<string, { color: string; bgColor: string; icon: React.ReactNode }> = {
  critical: {
    color: "text-red-400",
    bgColor: "bg-red-500/20 border-red-500/30",
    icon: <AlertTriangle className="w-4 h-4" />
  },
  high: {
    color: "text-red-400",
    bgColor: "bg-red-500/20 border-red-500/30",
    icon: <AlertTriangle className="w-4 h-4" />
  },
  medium: {
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20 border-yellow-500/30",
    icon: <Bell className="w-4 h-4" />
  },
  low: {
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20 border-cyan-500/30",
    icon: <Bell className="w-4 h-4" />
  }
};

function formatDate(dateString: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

function formatCurrency(value: string | number) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return "$0";
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}

function formatPercentage(value: string | number) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return "0%";
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
}

function getDaysUntil(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);
  return diffDays;
}

function getHealthStatus(health: number): { label: string; color: string } {
  if (health >= 80) return { label: "Healthy", color: "text-green-400" };
  if (health >= 50) return { label: "Warning", color: "text-yellow-400" };
  return { label: "Critical", color: "text-red-400" };
}

function getSceneProgress(project: VideoProject) {
  const scenes = project.scenes || [];
  const clips = project.clips || [];
  
  const totalScenes = scenes.length;
  const completedScenes = scenes.filter(s => s.status === "ready").length;
  const failedScenes = scenes.filter(s => s.status === "failed").length;
  const generatingScenes = scenes.filter(s => s.status === "generating" || s.status === "processing").length;
  
  const readyClips = clips.filter(c => c.status === "ready").length;
  const failedClips = clips.filter(c => c.status === "failed").length;
  
  return {
    total: totalScenes,
    completed: completedScenes,
    failed: failedScenes,
    generating: generatingScenes,
    readyClips,
    failedClips,
    totalClips: clips.length,
    percentage: totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0
  };
}

function hasFailedScenes(project: VideoProject) {
  const scenes = project.scenes || [];
  const clips = project.clips || [];
  return project.status === "failed" || 
    scenes.some(s => s.status === "failed") ||
    clips.some(c => c.status === "failed");
}

export default function DashboardPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("pending");

  const { data: kpis } = useQuery<Kpi>({
    queryKey: ["/api/kpis"],
    queryFn: async () => {
      const res = await fetch("/api/kpis");
      if (!res.ok) throw new Error("Failed to fetch KPIs");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: alertsList = [] } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    queryFn: async () => {
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: podsList = [] } = useQuery<Pod[]>({
    queryKey: ["/api/pods"],
    queryFn: async () => {
      const res = await fetch("/api/pods");
      if (!res.ok) throw new Error("Failed to fetch pods");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: phaseChangesList = [] } = useQuery<PhaseChange[]>({
    queryKey: ["/api/phase-changes"],
    queryFn: async () => {
      const res = await fetch("/api/phase-changes");
      if (!res.ok) throw new Error("Failed to fetch phase changes");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: approvals = [], isLoading } = useQuery<ApprovalItem[]>({
    queryKey: ["/api/approvals", activeTab],
    queryFn: async () => {
      const url = activeTab === "all" 
        ? "/api/approvals?status=all"
        : `/api/approvals?status=${activeTab}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch approvals");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: videoProjects = [], isLoading: isLoadingProjects } = useQuery<VideoProject[]>({
    queryKey: ["/api/video-projects"],
    queryFn: async () => {
      const res = await fetch("/api/video-projects");
      if (!res.ok) throw new Error("Failed to fetch video projects");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/approvals/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to approve item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
      toast({ title: "Approved", description: "Item has been approved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/approvals/${id}/reject`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to reject item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
      toast({ title: "Rejected", description: "Item has been rejected" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`/api/video-projects/${projectId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "runway" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects"] });
      toast({ 
        title: "Regeneration started", 
        description: `Retrying ${data.scenesToRegenerate || 0} failed scenes` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const dismissAlertMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to dismiss alert");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({ title: "Dismissed", description: "Alert has been dismissed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const clearApprovalsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/approvals/clear", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear approval queue");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals"] });
      toast({ 
        title: "Cleared", 
        description: `Removed ${data.deletedCount || 0} approval items` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const clearVideoProjectsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/video-projects/clear", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear video projects");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects"] });
      toast({ 
        title: "Cleared", 
        description: `Removed ${data.deletedCount || 0} video projects` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getCounts = () => {
    const allApprovals = queryClient.getQueryData<ApprovalItem[]>(["/api/approvals", "all"]) || [];
    return {
      pending: allApprovals.filter(a => a.status === "pending").length,
      approved: allApprovals.filter(a => a.status === "approved").length,
      rejected: allApprovals.filter(a => a.status === "rejected").length,
      all: allApprovals.length
    };
  };

  useQuery<ApprovalItem[]>({
    queryKey: ["/api/approvals", "all"],
    queryFn: async () => {
      const res = await fetch("/api/approvals?status=all");
      if (!res.ok) throw new Error("Failed to fetch approvals");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const counts = getCounts();
  
  const recentProjects = videoProjects.slice(0, 5);
  const generatingCount = videoProjects.filter(p => 
    p.status === "generating" || p.status === "processing"
  ).length;
  const completedCount = videoProjects.filter(p => 
    p.status === "ready" || p.status === "exported"
  ).length;
  const failedCount = videoProjects.filter(p => p.status === "failed").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400 flex items-center gap-3" data-testid="text-dashboard-title">
              <LayoutDashboard className="w-8 h-8" />
              Dashboard
            </h1>
            <p className="text-zinc-400 mt-1">Operational metrics and content management</p>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/video-projects">
              <Button variant="outline" className="border-zinc-700 hover:bg-zinc-800" data-testid="link-video-projects">
                <FileText className="w-4 h-4 mr-2" />
                Video Projects
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="outline" className="border-zinc-700 hover:bg-zinc-800" data-testid="link-settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI Summary Cards - Top Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-zinc-900 border-zinc-700" data-testid="card-kpi-mrr">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Monthly Recurring Revenue</p>
                  <p className="text-2xl font-bold text-green-400">
                    {kpis ? formatCurrency(kpis.mrr) : "$0"}
                  </p>
                  {kpis && (
                    <p className={`text-xs mt-1 ${parseFloat(kpis.mrrChange) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPercentage(kpis.mrrChange)} from last month
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-700" data-testid="card-kpi-profit">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Profit Today</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {kpis ? formatCurrency(kpis.profitToday) : "$0"}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">Daily profit margin</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-700" data-testid="card-kpi-ai-output">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">AI Output Today</p>
                  <p className="text-2xl font-bold text-cyan-400">
                    {kpis?.aiOutputToday || 0}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">pieces generated</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-700" data-testid="card-kpi-pods">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Active Pods</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {kpis ? `${kpis.activePods}/${kpis.totalPods}` : `${podsList.length}/0`}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">business units online</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second Row: Alerts + Pods Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Active Alerts Section */}
          <Card className="bg-zinc-900 border-zinc-700" data-testid="card-alerts">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2 text-lg">
                <AlertTriangle className="w-5 h-5" />
                Active Alerts
                {alertsList.length > 0 && (
                  <Badge className="ml-2 bg-red-500/20 text-red-400 border-red-500/30">
                    {alertsList.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertsList.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No active alerts</p>
                  <p className="text-xs mt-1">All systems operating normally</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {alertsList.map((alert) => {
                    const config = severityConfig[alert.severity] || severityConfig.medium;
                    return (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${config.bgColor} transition-colors`}
                        data-testid={`alert-item-${alert.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={config.color}>
                              {config.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-white text-sm" data-testid={`text-alert-title-${alert.id}`}>
                                  {alert.title}
                                </span>
                                <Badge variant="outline" className={`text-xs ${config.bgColor} ${config.color}`}>
                                  {alert.severity}
                                </Badge>
                              </div>
                              <p className="text-xs text-zinc-400 line-clamp-2" data-testid={`text-alert-description-${alert.id}`}>
                                {alert.description}
                              </p>
                              <p className="text-xs text-zinc-500 mt-1">
                                {formatRelativeTime(alert.createdAt)}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-zinc-400 hover:text-white hover:bg-zinc-700"
                            onClick={() => dismissAlertMutation.mutate(alert.id)}
                            disabled={dismissAlertMutation.isPending}
                            data-testid={`button-dismiss-alert-${alert.id}`}
                          >
                            {dismissAlertMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pods Status Section */}
          <Card className="bg-zinc-900 border-zinc-700" data-testid="card-pods">
            <CardHeader>
              <CardTitle className="text-yellow-400 flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5" />
                Pods Status
                {podsList.length > 0 && (
                  <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    {podsList.filter(p => p.isActive).length} active
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {podsList.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No pods configured</p>
                  <p className="text-xs mt-1">Add business units to monitor</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                  {podsList.map((pod) => {
                    const healthStatus = getHealthStatus(pod.health);
                    return (
                      <div
                        key={pod.id}
                        className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
                        data-testid={`pod-card-${pod.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-white text-sm truncate" data-testid={`text-pod-name-${pod.id}`}>
                            {pod.name}
                          </span>
                          <Badge variant="outline" className={`text-xs ${pod.isActive ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}`}>
                            {pod.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400">Health</span>
                            <span className={healthStatus.color} data-testid={`text-pod-health-${pod.id}`}>
                              {healthStatus.label} ({pod.health}%)
                            </span>
                          </div>
                          <Progress value={pod.health} className="h-1.5 bg-zinc-700" />
                          <div className="flex items-center justify-between text-xs mt-2">
                            <span className="text-zinc-400">Vertical</span>
                            <span className="text-zinc-300">{pod.vertical}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400">MRR</span>
                            <span className="text-green-400">{formatCurrency(pod.mrr)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Third Row: Phase Changes + Video Projects */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Phase Changes Section */}
          <Card className="bg-zinc-900 border-zinc-700" data-testid="card-phase-changes">
            <CardHeader>
              <CardTitle className="text-purple-400 flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5" />
                Upcoming Phase Changes
                {phaseChangesList.length > 0 && (
                  <Badge className="ml-2 bg-purple-500/20 text-purple-400 border-purple-500/30">
                    {phaseChangesList.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {phaseChangesList.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No upcoming phase changes</p>
                  <p className="text-xs mt-1">All pricing is stable</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {phaseChangesList.map((change) => {
                    const daysUntil = getDaysUntil(change.changeDate);
                    let urgencyColor = "text-green-400 bg-green-500/20 border-green-500/30";
                    if (daysUntil <= 3) urgencyColor = "text-red-400 bg-red-500/20 border-red-500/30";
                    else if (daysUntil <= 7) urgencyColor = "text-yellow-400 bg-yellow-500/20 border-yellow-500/30";
                    else if (daysUntil <= 14) urgencyColor = "text-cyan-400 bg-cyan-500/20 border-cyan-500/30";

                    return (
                      <div
                        key={change.id}
                        className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
                        data-testid={`phase-change-${change.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-white text-sm" data-testid={`text-phase-client-${change.id}`}>
                            {change.client}
                          </span>
                          <Badge variant="outline" className={`text-xs ${urgencyColor}`}>
                            {daysUntil > 0 ? `${daysUntil} days` : daysUntil === 0 ? 'Today' : 'Overdue'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-zinc-400">{formatCurrency(change.oldPrice)}</span>
                          <ArrowRight className="w-4 h-4 text-purple-400" />
                          <span className="text-purple-400 font-medium">{formatCurrency(change.newPrice)}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">
                          Effective: {formatDate(change.changeDate)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Video Projects Section */}
          <Card className="bg-zinc-900 border-zinc-700" data-testid="card-video-projects">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-cyan-400 flex items-center gap-2 text-lg">
                  <Video className="w-5 h-5" />
                  Recent Video Projects
                  {videoProjects.length > 0 && (
                    <div className="flex gap-1 ml-2">
                      {generatingCount > 0 && (
                        <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          {generatingCount}
                        </Badge>
                      )}
                      {completedCount > 0 && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {completedCount}
                        </Badge>
                      )}
                      {failedCount > 0 && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          <XCircle className="w-3 h-3 mr-1" />
                          {failedCount}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => clearVideoProjectsMutation.mutate()}
                    disabled={clearVideoProjectsMutation.isPending || videoProjects.length === 0}
                    data-testid="button-clear-video-projects"
                  >
                    {clearVideoProjectsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                  <Link href="/video-projects">
                    <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-cyan-400" data-testid="button-view-all-projects">
                      View All
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingProjects ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Video className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No video projects yet</p>
                  <Link href="/video-projects">
                    <Button variant="outline" size="sm" className="mt-3 border-zinc-700 hover:bg-zinc-800" data-testid="button-create-first-project">
                      Create First Project
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {recentProjects.map((project) => {
                    const progress = getSceneProgress(project);
                    const statusConf = videoStatusConfig[project.status] || videoStatusConfig.draft;
                    const hasFailed = hasFailedScenes(project);
                    
                    return (
                      <div
                        key={project.projectId}
                        className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
                        data-testid={`video-project-card-${project.projectId}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Film className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                              <span className="font-medium text-white text-sm truncate" data-testid={`text-project-title-${project.projectId}`}>
                                {project.title}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={statusConf.color}
                                data-testid={`badge-status-${project.projectId}`}
                              >
                                {statusConf.icon}
                                <span className="ml-1">{statusConf.label}</span>
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="mb-2">
                          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              Progress
                            </span>
                            <span data-testid={`text-scene-progress-${project.projectId}`}>
                              {progress.completed}/{progress.total} scenes
                              {progress.failed > 0 && (
                                <span className="text-red-400 ml-1">({progress.failed} failed)</span>
                              )}
                            </span>
                          </div>
                          <Progress 
                            value={progress.percentage} 
                            className="h-1.5 bg-zinc-700"
                            data-testid={`progress-bar-${project.projectId}`}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500" data-testid={`text-created-date-${project.projectId}`}>
                            {formatRelativeTime(project.createdAt)}
                          </span>
                          <div className="flex items-center gap-2">
                            {hasFailed && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-500"
                                onClick={() => regenerateMutation.mutate(project.projectId)}
                                disabled={regenerateMutation.isPending}
                                data-testid={`button-retry-${project.projectId}`}
                              >
                                {regenerateMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Retry
                                  </>
                                )}
                              </Button>
                            )}
                            <Link href={`/video-projects`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs border-zinc-600 hover:bg-zinc-700"
                                data-testid={`button-view-${project.projectId}`}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fourth Row: Approval Queue - Full Width */}
        <Card className="bg-zinc-900 border-zinc-700" data-testid="card-approval-queue">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-cyan-400 flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                Approval Queue
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={() => clearApprovalsMutation.mutate()}
                disabled={clearApprovalsMutation.isPending || counts.all === 0}
                data-testid="button-clear-approvals"
              >
                {clearApprovalsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-zinc-800 border border-zinc-700 mb-4">
                <TabsTrigger 
                  value="pending" 
                  className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400"
                  data-testid="tab-pending"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Pending
                  {counts.pending > 0 && (
                    <Badge className="ml-2 bg-yellow-500/30 text-yellow-400 border-yellow-500/50">
                      {counts.pending}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="approved" 
                  className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400"
                  data-testid="tab-approved"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approved
                  {counts.approved > 0 && (
                    <Badge className="ml-2 bg-green-500/30 text-green-400 border-green-500/50">
                      {counts.approved}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="rejected" 
                  className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400"
                  data-testid="tab-rejected"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rejected
                  {counts.rejected > 0 && (
                    <Badge className="ml-2 bg-red-500/30 text-red-400 border-red-500/50">
                      {counts.rejected}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="all" 
                  className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
                  data-testid="tab-all"
                >
                  All
                  {counts.all > 0 && (
                    <Badge className="ml-2 bg-cyan-500/30 text-cyan-400 border-cyan-500/50">
                      {counts.all}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  </div>
                ) : approvals.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No {activeTab === "all" ? "" : activeTab} items in the queue</p>
                    <p className="text-xs mt-1">
                      {activeTab === "pending" 
                        ? "All items have been processed" 
                        : "No items with this status yet"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                    {approvals.slice(0, 12).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
                        data-testid={`approval-item-${item.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <img
                            src={item.thumbnail}
                            alt={item.type}
                            className="w-10 h-10 rounded-lg object-cover border border-zinc-600 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white text-sm truncate">{item.client}</span>
                              <Badge 
                                variant="outline" 
                                className={`${statusConfig[item.status]?.color || "bg-zinc-500/20 text-zinc-400"} text-xs`}
                              >
                                {statusConfig[item.status]?.icon}
                                <span className="ml-1">{statusConfig[item.status]?.label || item.status}</span>
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                              <span className="capitalize truncate">{item.type.replace(/_/g, " ")}</span>
                              <span>•</span>
                              <span>{formatRelativeTime(item.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        {item.status === "pending" && (
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-500"
                              onClick={() => rejectMutation.mutate(item.id)}
                              disabled={rejectMutation.isPending || approveMutation.isPending}
                              data-testid={`button-reject-${item.id}`}
                            >
                              {rejectMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 px-2 bg-green-600 hover:bg-green-500 text-white"
                              onClick={() => approveMutation.mutate(item.id)}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              data-testid={`button-approve-${item.id}`}
                            >
                              {approveMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
