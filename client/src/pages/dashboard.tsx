import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  FileText,
  LayoutDashboard,
  Settings
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

export default function DashboardPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("pending");

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

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400 flex items-center gap-3">
              <LayoutDashboard className="w-8 h-8" />
              Dashboard
            </h1>
            <p className="text-zinc-400 mt-1">Manage approvals and content review</p>
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

        <Card className="bg-zinc-900 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-cyan-400 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Approval Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-zinc-800 border border-zinc-700 mb-6">
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
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  </div>
                ) : approvals.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No {activeTab === "all" ? "" : activeTab} items in the queue</p>
                    <p className="text-sm mt-1">
                      {activeTab === "pending" 
                        ? "All items have been processed" 
                        : "No items with this status yet"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {approvals.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
                        data-testid={`approval-item-${item.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={item.thumbnail}
                            alt={item.type}
                            className="w-12 h-12 rounded-lg object-cover border border-zinc-600"
                          />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white">{item.client}</span>
                              <Badge 
                                variant="outline" 
                                className={statusConfig[item.status]?.color || "bg-zinc-500/20 text-zinc-400"}
                              >
                                {statusConfig[item.status]?.icon}
                                <span className="ml-1">{statusConfig[item.status]?.label || item.status}</span>
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-400">
                              <span className="capitalize">{item.type.replace(/_/g, " ")}</span>
                              <span>•</span>
                              <span>by {item.author}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                              <span>Created {formatRelativeTime(item.createdAt)}</span>
                              {item.processedAt && item.status !== "pending" && (
                                <>
                                  <span>•</span>
                                  <span className={item.status === "approved" ? "text-green-400" : "text-red-400"}>
                                    {item.status === "approved" ? "Approved" : "Rejected"} {formatRelativeTime(item.processedAt)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {item.status === "pending" && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-500"
                              onClick={() => rejectMutation.mutate(item.id)}
                              disabled={rejectMutation.isPending || approveMutation.isPending}
                              data-testid={`button-reject-${item.id}`}
                            >
                              {rejectMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4 mr-1" />
                              )}
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-500 text-white"
                              onClick={() => approveMutation.mutate(item.id)}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              data-testid={`button-approve-${item.id}`}
                            >
                              {approveMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                              )}
                              Approve
                            </Button>
                          </div>
                        )}

                        {item.status !== "pending" && (
                          <div className="text-sm text-zinc-500">
                            {formatDate(item.processedAt)}
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
