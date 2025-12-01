import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Factory,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Loader2,
  Calendar,
  Hash,
  Zap,
  RefreshCw,
  LayoutGrid,
  List,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Video,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  PenTool,
  Filter,
  X,
} from "lucide-react";

type Client = {
  id: number;
  name: string;
  industry: string;
  brandVoice: string;
  targetAudience: string;
  keywords: string;
  contentGoals: string;
  isActive: boolean;
  createdAt: string;
};

type ContentRun = {
  id: number;
  runId: string;
  clientId: number;
  status: string;
  totalPieces: number;
  successfulPieces: number;
  failedPieces: number;
  startedAt: string;
  completedAt: string | null;
};

type GeneratedContent = {
  id: number;
  contentId: string;
  runId: string;
  clientId: number;
  type: string;
  title: string;
  content: string;
  metadata: string | null;
  status: string;
  qaScore: number | null;
  createdAt: string;
  videoUrl?: string | null;
  imageDataUrl?: string | null;
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: {
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: <Clock className="w-3 h-3" />,
    label: "Pending",
  },
  running: {
    color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    label: "Running",
  },
  completed: {
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: "Completed",
  },
  failed: {
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: <XCircle className="w-3 h-3" />,
    label: "Failed",
  },
  draft: {
    color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    icon: <PenTool className="w-3 h-3" />,
    label: "Draft",
  },
  pending_review: {
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    icon: <Eye className="w-3 h-3" />,
    label: "Pending Review",
  },
  approved: {
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: "Approved",
  },
  rejected: {
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: <XCircle className="w-3 h-3" />,
    label: "Rejected",
  },
};

const contentTypeConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  blog: {
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    icon: <FileText className="w-3 h-3" />,
    label: "Blog",
  },
  linkedin: {
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: <Linkedin className="w-3 h-3" />,
    label: "LinkedIn",
  },
  twitter: {
    color: "bg-sky-500/20 text-sky-400 border-sky-500/30",
    icon: <Twitter className="w-3 h-3" />,
    label: "Twitter",
  },
  instagram: {
    color: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    icon: <Instagram className="w-3 h-3" />,
    label: "Instagram",
  },
  facebook_ad: {
    color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    icon: <Facebook className="w-3 h-3" />,
    label: "Facebook Ad",
  },
  video_script: {
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: <Video className="w-3 h-3" />,
    label: "Video Script",
  },
};

function formatDate(dateString: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

export default function ContentFactoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [contentView, setContentView] = useState<"grid" | "list">("grid");
  const [contentTab, setContentTab] = useState<string>("all");
  const [selectedContentType, setSelectedContentType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const { data: clients = [], isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: contentRuns = [], isLoading: isLoadingRuns } = useQuery<ContentRun[]>({
    queryKey: ["/api/content-runs"],
    queryFn: async () => {
      const res = await fetch("/api/content-runs");
      if (!res.ok) throw new Error("Failed to fetch content runs");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: generatedContent = [], isLoading: isLoadingContent } = useQuery<GeneratedContent[]>({
    queryKey: ["/api/content", selectedClientId],
    queryFn: async () => {
      const url = selectedClientId
        ? `/api/content?clientId=${selectedClientId}`
        : "/api/content";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch content");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const runPipelineMutation = useMutation({
    mutationFn: async (clientId: number) => {
      const res = await fetch("/api/content-factory/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          topicCount: 5,
          contentTypes: ["blog", "linkedin", "twitter"],
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to start pipeline");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-runs"] });
      toast({
        title: "Pipeline Started",
        description: `Content run ${data.runId} has been initiated`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const runWeekMutation = useMutation({
    mutationFn: async (clientId: number) => {
      const res = await fetch("/api/content-factory/run-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to start weekly run");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-runs"] });
      toast({
        title: "Weekly Run Started",
        description: `Generating ${data.estimatedPieces} pieces of content`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ contentId, status }: { contentId: string; status: string }) => {
      const res = await fetch(`/api/content/${contentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({
        title: variables.status === "approved" ? "Content Approved" : "Content Rejected",
        description: `Content has been ${variables.status}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectedClient = clients.find((c) => c.id.toString() === selectedClientId);
  const runningRuns = contentRuns.filter((r) => r.status === "running").length;
  const completedRuns = contentRuns.filter((r) => r.status === "completed").length;
  const totalContent = generatedContent.length;
  const approvedContent = generatedContent.filter((c) => c.status === "approved").length;

  const filteredContent = generatedContent.filter((content) => {
    // Filter by status (using dropdown or tabs)
    const statusToCheck = selectedStatus !== "all" ? selectedStatus : contentTab;
    if (statusToCheck !== "all") {
      if (statusToCheck === "pending" && content.status !== "pending_review") return false;
      if (statusToCheck === "pending_review" && content.status !== "pending_review") return false;
      if (statusToCheck === "approved" && content.status !== "approved") return false;
      if (statusToCheck === "rejected" && content.status !== "rejected") return false;
      if (statusToCheck === "draft" && content.status !== "draft") return false;
    }
    
    // Filter by content type
    if (selectedContentType !== "all" && content.type !== selectedContentType) return false;
    
    // Filter by client (content library specific filter)
    if (selectedClientId && selectedClientId !== "all" && content.clientId.toString() !== selectedClientId) return false;
    
    return true;
  });

  const activeFilterCount = [
    selectedContentType !== "all",
    selectedStatus !== "all",
    selectedClientId !== "" && selectedClientId !== "all",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSelectedContentType("all");
    setSelectedStatus("all");
    setSelectedClientId("all");
    setContentTab("all");
  };

  const getClientName = (clientId: number) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || `Client ${clientId}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-3xl font-bold text-cyan-400 flex items-center gap-3"
              data-testid="text-page-title"
            >
              <Factory className="w-8 h-8" />
              Content Factory
            </h1>
            <p className="text-zinc-400 mt-1" data-testid="text-page-subtitle">
              AI-powered content generation pipeline
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-zinc-900 border-zinc-700" data-testid="card-stat-running">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Running Pipelines</p>
                  <p className="text-2xl font-bold text-cyan-400">{runningRuns}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Loader2 className={`w-5 h-5 text-cyan-400 ${runningRuns > 0 ? "animate-spin" : ""}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-700" data-testid="card-stat-completed">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Completed Runs</p>
                  <p className="text-2xl font-bold text-green-400">{completedRuns}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-700" data-testid="card-stat-content">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Total Content</p>
                  <p className="text-2xl font-bold text-purple-400">{totalContent}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-700" data-testid="card-stat-approved">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Approved</p>
                  <p className="text-2xl font-bold text-green-400">{approvedContent}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <ThumbsUp className="w-5 h-5 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-zinc-900 border-zinc-700 mb-8" data-testid="card-pipeline-controls">
          <CardHeader>
            <CardTitle className="text-cyan-400 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Pipeline Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex-1 w-full md:w-auto">
                <label className="text-sm text-zinc-400 mb-2 block">Select Client</label>
                <Select
                  value={selectedClientId}
                  onValueChange={setSelectedClientId}
                  disabled={isLoadingClients}
                >
                  <SelectTrigger
                    className="w-full md:w-64 bg-zinc-800 border-zinc-700"
                    data-testid="select-client"
                  >
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {clients.map((client) => (
                      <SelectItem
                        key={client.id}
                        value={client.id.toString()}
                        data-testid={`select-client-option-${client.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{client.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {client.industry}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClient && (
                <div className="flex-1 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                  <p className="text-sm text-zinc-300">
                    <span className="text-zinc-500">Target:</span> {selectedClient.targetAudience}
                  </p>
                  <p className="text-sm text-zinc-300 mt-1">
                    <span className="text-zinc-500">Voice:</span> {selectedClient.brandVoice}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="bg-cyan-600 hover:bg-cyan-500"
                  disabled={!selectedClientId || runPipelineMutation.isPending}
                  onClick={() => runPipelineMutation.mutate(parseInt(selectedClientId))}
                  data-testid="button-run-pipeline"
                >
                  {runPipelineMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Run Pipeline
                </Button>
                <Button
                  variant="outline"
                  className="border-cyan-600 text-cyan-400 hover:bg-cyan-600/20"
                  disabled={!selectedClientId || runWeekMutation.isPending}
                  onClick={() => runWeekMutation.mutate(parseInt(selectedClientId))}
                  data-testid="button-run-week"
                >
                  {runWeekMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Calendar className="w-4 h-4 mr-2" />
                  )}
                  Run Week
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-900 border-zinc-700 lg:col-span-1" data-testid="card-content-runs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-cyan-400 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Content Runs
                </CardTitle>
                <Badge variant="outline" className="text-zinc-400">
                  {contentRuns.length} runs
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingRuns ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                </div>
              ) : contentRuns.length === 0 ? (
                <div className="text-center py-8 text-zinc-500" data-testid="empty-runs">
                  <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No content runs yet</p>
                  <p className="text-xs mt-1">Select a client and run the pipeline</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {contentRuns.slice(0, 10).map((run) => {
                    const statusConf = statusConfig[run.status] || statusConfig.pending;
                    return (
                      <div
                        key={run.runId}
                        className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
                        data-testid={`run-item-${run.runId}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-zinc-300 font-medium truncate max-w-[120px]">
                            {getClientName(run.clientId)}
                          </span>
                          <Badge className={statusConf.color}>
                            {statusConf.icon}
                            <span className="ml-1">{statusConf.label}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            {run.totalPieces} pieces
                          </span>
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle2 className="w-3 h-3" />
                            {run.successfulPieces}
                          </span>
                          {run.failedPieces > 0 && (
                            <span className="flex items-center gap-1 text-red-400">
                              <XCircle className="w-3 h-3" />
                              {run.failedPieces}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-600 mt-2">
                          {formatRelativeTime(run.startedAt)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-700 lg:col-span-2" data-testid="card-content-library">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-cyan-400 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Generated Content Library
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={contentView === "grid" ? "text-cyan-400" : "text-zinc-500"}
                    onClick={() => setContentView("grid")}
                    data-testid="button-view-grid"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={contentView === "list" ? "text-cyan-400" : "text-zinc-500"}
                    onClick={() => setContentView("list")}
                    data-testid="button-view-list"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Filter className="w-4 h-4" />
                    <span>Filters:</span>
                  </div>
                  
                  <Select value={selectedContentType} onValueChange={setSelectedContentType}>
                    <SelectTrigger 
                      className="w-[140px] h-8 bg-zinc-800 border-zinc-700 text-sm"
                      data-testid="filter-content-type"
                    >
                      <SelectValue placeholder="Content Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="blog">
                        <span className="flex items-center gap-2">
                          <FileText className="w-3 h-3 text-purple-400" />
                          Blog
                        </span>
                      </SelectItem>
                      <SelectItem value="linkedin">
                        <span className="flex items-center gap-2">
                          <Linkedin className="w-3 h-3 text-blue-400" />
                          LinkedIn
                        </span>
                      </SelectItem>
                      <SelectItem value="twitter">
                        <span className="flex items-center gap-2">
                          <Twitter className="w-3 h-3 text-sky-400" />
                          Twitter
                        </span>
                      </SelectItem>
                      <SelectItem value="instagram">
                        <span className="flex items-center gap-2">
                          <Instagram className="w-3 h-3 text-pink-400" />
                          Instagram
                        </span>
                      </SelectItem>
                      <SelectItem value="facebook_ad">
                        <span className="flex items-center gap-2">
                          <Facebook className="w-3 h-3 text-indigo-400" />
                          Facebook Ad
                        </span>
                      </SelectItem>
                      <SelectItem value="video_script">
                        <span className="flex items-center gap-2">
                          <Video className="w-3 h-3 text-red-400" />
                          Video Script
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger 
                      className="w-[160px] h-8 bg-zinc-800 border-zinc-700 text-sm"
                      data-testid="filter-client"
                    >
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedStatus} onValueChange={(value) => {
                    setSelectedStatus(value);
                    if (value !== "all") setContentTab("all");
                  }}>
                    <SelectTrigger 
                      className="w-[150px] h-8 bg-zinc-800 border-zinc-700 text-sm"
                      data-testid="filter-status"
                    >
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending_review">
                        <span className="flex items-center gap-2">
                          <Eye className="w-3 h-3 text-orange-400" />
                          Pending Review
                        </span>
                      </SelectItem>
                      <SelectItem value="approved">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                          Approved
                        </span>
                      </SelectItem>
                      <SelectItem value="rejected">
                        <span className="flex items-center gap-2">
                          <XCircle className="w-3 h-3 text-red-400" />
                          Rejected
                        </span>
                      </SelectItem>
                      <SelectItem value="draft">
                        <span className="flex items-center gap-2">
                          <PenTool className="w-3 h-3 text-zinc-400" />
                          Draft
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="h-8 px-2 text-zinc-400 hover:text-white"
                      data-testid="button-clear-filters"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear ({activeFilterCount})
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <Tabs value={contentTab} onValueChange={(value) => {
                    setContentTab(value);
                    if (value !== "all") setSelectedStatus("all");
                  }}>
                    <TabsList className="bg-zinc-800 border border-zinc-700">
                      <TabsTrigger
                        value="all"
                        className="data-[state=active]:bg-cyan-600 text-xs"
                        data-testid="tab-all"
                      >
                        All ({generatedContent.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="pending"
                        className="data-[state=active]:bg-orange-600 text-xs"
                        data-testid="tab-pending"
                      >
                        Pending ({generatedContent.filter((c) => c.status === "pending_review").length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="approved"
                        className="data-[state=active]:bg-green-600 text-xs"
                        data-testid="tab-approved"
                      >
                        Approved ({approvedContent})
                      </TabsTrigger>
                      <TabsTrigger
                        value="rejected"
                        className="data-[state=active]:bg-red-600 text-xs"
                        data-testid="tab-rejected"
                      >
                        Rejected ({generatedContent.filter((c) => c.status === "rejected").length})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <span className="text-xs text-zinc-500">
                    Showing {filteredContent.length} of {generatedContent.length}
                  </span>
                </div>
              </div>

              {isLoadingContent ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                </div>
              ) : filteredContent.length === 0 ? (
                <div className="text-center py-12 text-zinc-500" data-testid="empty-content">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No content found</p>
                  <p className="text-xs mt-1">Run a pipeline to generate content</p>
                </div>
              ) : contentView === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
                  {filteredContent.map((content) => {
                    const typeConf = contentTypeConfig[content.type] || contentTypeConfig.blog;
                    const statusConf = statusConfig[content.status] || statusConfig.draft;
                    return (
                      <div
                        key={content.contentId}
                        className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
                        data-testid={`content-card-${content.contentId}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <Badge className={typeConf.color}>
                            {typeConf.icon}
                            <span className="ml-1">{typeConf.label}</span>
                          </Badge>
                          <Badge className={statusConf.color}>
                            {statusConf.icon}
                            <span className="ml-1">{statusConf.label}</span>
                          </Badge>
                        </div>
                        <h4 className="text-sm font-medium text-white mb-2 line-clamp-2">
                          {content.title}
                        </h4>
                        <p className="text-xs text-zinc-400 line-clamp-3 mb-3">
                          {content.content.substring(0, 150)}...
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500">
                            {formatRelativeTime(content.createdAt)}
                          </span>
                          {content.status === "pending_review" && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-green-400 hover:bg-green-500/20"
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    contentId: content.contentId,
                                    status: "approved",
                                  })
                                }
                                disabled={updateStatusMutation.isPending}
                                data-testid={`button-approve-${content.contentId}`}
                              >
                                <ThumbsUp className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-red-400 hover:bg-red-500/20"
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    contentId: content.contentId,
                                    status: "rejected",
                                  })
                                }
                                disabled={updateStatusMutation.isPending}
                                data-testid={`button-reject-${content.contentId}`}
                              >
                                <ThumbsDown className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          {content.qaScore && (
                            <Badge variant="outline" className="text-xs">
                              QA: {content.qaScore}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {filteredContent.map((content) => {
                    const typeConf = contentTypeConfig[content.type] || contentTypeConfig.blog;
                    const statusConf = statusConfig[content.status] || statusConfig.draft;
                    return (
                      <div
                        key={content.contentId}
                        className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
                        data-testid={`content-row-${content.contentId}`}
                      >
                        <Badge className={typeConf.color}>
                          {typeConf.icon}
                          <span className="ml-1">{typeConf.label}</span>
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-white truncate">
                            {content.title}
                          </h4>
                          <p className="text-xs text-zinc-500">
                            {getClientName(content.clientId)} • {formatRelativeTime(content.createdAt)}
                          </p>
                        </div>
                        <Badge className={statusConf.color}>
                          {statusConf.icon}
                          <span className="ml-1">{statusConf.label}</span>
                        </Badge>
                        {content.status === "pending_review" && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-green-400 hover:bg-green-500/20"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  contentId: content.contentId,
                                  status: "approved",
                                })
                              }
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-approve-list-${content.contentId}`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-red-400 hover:bg-red-500/20"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  contentId: content.contentId,
                                  status: "rejected",
                                })
                              }
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-reject-list-${content.contentId}`}
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
