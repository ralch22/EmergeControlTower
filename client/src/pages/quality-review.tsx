import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Star, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Play, 
  FileText, 
  Video,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Award,
  Zap,
  Target,
} from "lucide-react";

interface QualityReview {
  id: number;
  contentType: string;
  contentId: string;
  overallRating: number | null;
  isAccepted: boolean;
  rejectionReason: string | null;
  reviewerFeedback: string | null;
  reviewedBy: string | null;
  createdAt: string;
}

interface ProviderQualityScore {
  id: number;
  providerName: string;
  serviceType: string;
  totalReviews: number;
  totalAccepted: number;
  totalRejected: number;
  acceptanceRate: string;
  avgUserRating: string | null;
  avgQualityScore: string;
}

interface ProviderQualityStatus {
  providerName: string;
  serviceType: string;
  operationalHealth: number;
  qualityScore: number;
  combinedScore: number;
  acceptanceRate: number;
  avgUserRating: number;
  totalReviews: number;
}

interface VideoProject {
  id: number;
  projectId: string;
  title: string;
  status: string;
  qualityTier: string | null;
  targetResolution: string | null;
  isQualityApproved: boolean | null;
}

interface ContentPiece {
  id: number;
  contentId: string;
  title: string;
  type: string;
  status: string;
  provider: string | null;
}

export default function QualityReview() {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("pending");
  const [selectedContent, setSelectedContent] = useState<{
    type: string;
    id: string;
    title: string;
    provider?: string;
  } | null>(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{
    summary: { totalReviews: number; acceptedReviews: number; rejectedReviews: number; acceptanceRate: string; averageRating: string };
    providerScores: ProviderQualityScore[];
    qualityTiers: any[];
    recentReviews: QualityReview[];
    recentFeedback: any[];
  }>({
    queryKey: ["/api/quality/dashboard"],
    refetchInterval: 30000,
  });

  const { data: providerStatus, isLoading: statusLoading } = useQuery<{
    providers: ProviderQualityStatus[];
    timestamp: string;
  }>({
    queryKey: ["/api/quality/provider-status"],
    refetchInterval: 15000,
  });

  const { data: videoProjects } = useQuery({
    queryKey: ["/api/video-projects"],
    select: (data: VideoProject[]) => data.filter(p => 
      p.status === 'ready' && !p.isQualityApproved
    ),
  });

  const { data: pendingContent } = useQuery({
    queryKey: ["/api/approval/queue"],
    select: (data: ContentPiece[]) => data.filter(c => c.status === 'pending_review'),
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (data: {
      contentType: string;
      contentId: string;
      overallRating: number;
      isAccepted: boolean;
      rejectionReason?: string;
      reviewerFeedback?: string;
      providerName?: string;
      serviceType?: string;
    }) => {
      const res = await fetch("/api/quality/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to submit review");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quality/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/approval/queue"] });
      toast.success("Review submitted successfully");
      resetReviewForm();
    },
    onError: () => {
      toast.error("Failed to submit review");
    },
  });

  const submitProviderFeedbackMutation = useMutation({
    mutationFn: async (data: {
      providerName: string;
      serviceType: string;
      isAccepted: boolean;
      rating?: number;
    }) => {
      const res = await fetch("/api/quality/provider-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to submit feedback");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quality/provider-status"] });
      toast.success("Provider feedback recorded");
    },
  });

  const resetReviewForm = () => {
    setSelectedContent(null);
    setRating(0);
    setFeedback("");
    setRejectionReason("");
  };

  const handleAccept = () => {
    if (!selectedContent) return;
    
    submitReviewMutation.mutate({
      contentType: selectedContent.type,
      contentId: selectedContent.id,
      overallRating: rating,
      isAccepted: true,
      reviewerFeedback: feedback || undefined,
      providerName: selectedContent.provider,
      serviceType: selectedContent.type === 'video_project' ? 'video' : 'text',
    });

    if (selectedContent.provider) {
      submitProviderFeedbackMutation.mutate({
        providerName: selectedContent.provider,
        serviceType: selectedContent.type === 'video_project' ? 'video' : 'text',
        isAccepted: true,
        rating: rating || undefined,
      });
    }
  };

  const handleReject = () => {
    if (!selectedContent || !rejectionReason) {
      toast.error("Please provide a rejection reason");
      return;
    }
    
    submitReviewMutation.mutate({
      contentType: selectedContent.type,
      contentId: selectedContent.id,
      overallRating: rating,
      isAccepted: false,
      rejectionReason,
      reviewerFeedback: feedback || undefined,
      providerName: selectedContent.provider,
      serviceType: selectedContent.type === 'video_project' ? 'video' : 'text',
    });

    if (selectedContent.provider) {
      submitProviderFeedbackMutation.mutate({
        providerName: selectedContent.provider,
        serviceType: selectedContent.type === 'video_project' ? 'video' : 'text',
        isAccepted: false,
        rating: rating || undefined,
      });
    }
  };

  const StarRating = ({ value, onChange, readonly = false }: { 
    value: number; 
    onChange?: (v: number) => void;
    readonly?: boolean;
  }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          data-testid={`star-rating-${star}`}
        >
          <Star
            className={`w-6 h-6 ${
              star <= value
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );

  const QualityTierBadge = ({ tier }: { tier: string }) => {
    const tierConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      draft: { color: "bg-gray-500", icon: <Zap className="w-3 h-3" />, label: "Draft" },
      production: { color: "bg-blue-500", icon: <Target className="w-3 h-3" />, label: "Production" },
      cinematic_4k: { color: "bg-purple-500", icon: <Award className="w-3 h-3" />, label: "Cinematic 4K" },
    };
    const config = tierConfig[tier] || tierConfig.production;
    
    return (
      <Badge className={`${config.color} text-white flex items-center gap-1`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const providers: ProviderQualityStatus[] = providerStatus?.providers || [];
  const summary = dashboardData?.summary || { totalReviews: 0, acceptedReviews: 0, rejectedReviews: 0, acceptanceRate: "100", averageRating: "0" };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="page-title">Quality Review</h1>
            <p className="text-muted-foreground mt-1">
              Review and rate content outputs to improve AI quality over time
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/quality/dashboard"] });
              queryClient.invalidateQueries({ queryKey: ["/api/quality/provider-status"] });
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Reviews</p>
                  <p className="text-2xl font-bold">{summary.totalReviews}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Acceptance Rate</p>
                  <p className="text-2xl font-bold text-green-500">{summary.acceptanceRate}%</p>
                </div>
                <ThumbsUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-2xl font-bold text-red-500">{summary.rejectedReviews}</p>
                </div>
                <ThumbsDown className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Rating</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{summary.averageRating}</p>
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  </div>
                </div>
                <Award className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2" data-testid="tab-pending">
              <AlertCircle className="w-4 h-4" />
              Pending Review
              {(videoProjects?.length || 0) + (pendingContent?.length || 0) > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {(videoProjects?.length || 0) + (pendingContent?.length || 0)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="providers" className="gap-2" data-testid="tab-providers">
              <TrendingUp className="w-4 h-4" />
              Provider Quality
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
              <CheckCircle className="w-4 h-4" />
              Review History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5" />
                    Video Projects
                  </CardTitle>
                  <CardDescription>Ready for quality review</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {videoProjects?.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No video projects pending review
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {videoProjects?.map((project) => (
                          <div
                            key={project.projectId}
                            className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${
                              selectedContent?.id === project.projectId ? 'ring-2 ring-primary' : ''
                            }`}
                            onClick={() => setSelectedContent({
                              type: 'video_project',
                              id: project.projectId,
                              title: project.title,
                            })}
                            data-testid={`card-project-${project.projectId}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">{project.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {project.projectId}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {project.qualityTier && (
                                  <QualityTierBadge tier={project.qualityTier} />
                                )}
                                {project.targetResolution && (
                                  <Badge variant="outline">{project.targetResolution}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Content Pieces
                  </CardTitle>
                  <CardDescription>Text content awaiting review</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {pendingContent?.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No content pieces pending review
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {pendingContent?.map((content) => (
                          <div
                            key={content.contentId}
                            className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${
                              selectedContent?.id === content.contentId ? 'ring-2 ring-primary' : ''
                            }`}
                            onClick={() => setSelectedContent({
                              type: content.type,
                              id: content.contentId,
                              title: content.title,
                              provider: content.provider || undefined,
                            })}
                            data-testid={`card-content-${content.contentId}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">{content.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {content.type} • {content.contentId.slice(0, 16)}...
                                </p>
                              </div>
                              <Badge variant="secondary">{content.type}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {selectedContent && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle>Review: {selectedContent.title}</CardTitle>
                  <CardDescription>
                    {selectedContent.type} • {selectedContent.id}
                    {selectedContent.provider && ` • Provider: ${selectedContent.provider}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-center py-4 bg-muted rounded-lg">
                    <Play className="w-12 h-12 text-muted-foreground" />
                    <span className="ml-3 text-muted-foreground">Preview would appear here</span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Quality Rating</label>
                      <div className="mt-2">
                        <StarRating value={rating} onChange={setRating} />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Feedback (Optional)</label>
                      <Textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Any additional notes about the quality..."
                        className="mt-2"
                        data-testid="input-feedback"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Rejection Reason (Required for rejection)</label>
                      <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explain why this content doesn't meet quality standards..."
                        className="mt-2"
                        data-testid="input-rejection-reason"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      onClick={handleAccept}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={submitReviewMutation.isPending}
                      data-testid="button-accept"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Accept
                    </Button>
                    <Button
                      onClick={handleReject}
                      variant="destructive"
                      className="flex-1"
                      disabled={submitReviewMutation.isPending}
                      data-testid="button-reject"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={resetReviewForm}
                      variant="outline"
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="providers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Provider Quality Scores</CardTitle>
                <CardDescription>
                  Combined operational health and quality metrics for intelligent routing
                </CardDescription>
              </CardHeader>
              <CardContent>
                {statusLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading provider status...</p>
                ) : (
                  <div className="space-y-4">
                    {providers.map((provider) => (
                      <div
                        key={`${provider.providerName}-${provider.serviceType}`}
                        className="p-4 border rounded-lg"
                        data-testid={`provider-${provider.providerName}`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold capitalize">{provider.providerName}</h4>
                            <Badge variant="outline">{provider.serviceType}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold">
                              {provider.combinedScore.toFixed(0)}
                            </span>
                            <span className="text-sm text-muted-foreground">combined</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Operational Health</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress value={provider.operationalHealth} className="flex-1" />
                              <span className="text-sm font-medium">{provider.operationalHealth.toFixed(0)}%</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Quality Score</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress value={provider.qualityScore} className="flex-1" />
                              <span className="text-sm font-medium">{provider.qualityScore.toFixed(0)}%</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Acceptance Rate</p>
                            <p className="text-lg font-semibold text-green-500">
                              {provider.acceptanceRate.toFixed(0)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">User Rating</p>
                            <div className="flex items-center gap-1">
                              <span className="text-lg font-semibold">{provider.avgUserRating.toFixed(1)}</span>
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm text-muted-foreground">
                                ({provider.totalReviews} reviews)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {providers.length === 0 && (
                      <p className="text-center py-8 text-muted-foreground">
                        No provider quality data available yet
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Reviews</CardTitle>
                <CardDescription>Quality review history</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {dashboardLoading ? (
                    <p className="text-center py-8 text-muted-foreground">Loading reviews...</p>
                  ) : (
                    <div className="space-y-3">
                      {dashboardData?.recentReviews?.map((review: QualityReview) => (
                        <div
                          key={review.id}
                          className={`p-4 border rounded-lg ${
                            review.isAccepted ? 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900' : 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900'
                          }`}
                          data-testid={`review-${review.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {review.isAccepted ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
                              )}
                              <div>
                                <p className="font-medium">
                                  {review.contentType} - {review.contentId.slice(0, 16)}...
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(review.createdAt).toLocaleDateString()} by {review.reviewedBy || 'Anonymous'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {review.overallRating && (
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">{review.overallRating}</span>
                                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                </div>
                              )}
                              <Badge variant={review.isAccepted ? "default" : "destructive"}>
                                {review.isAccepted ? 'Accepted' : 'Rejected'}
                              </Badge>
                            </div>
                          </div>
                          {review.rejectionReason && (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                              Reason: {review.rejectionReason}
                            </p>
                          )}
                          {review.reviewerFeedback && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              Feedback: {review.reviewerFeedback}
                            </p>
                          )}
                        </div>
                      ))}

                      {(!dashboardData?.recentReviews || dashboardData.recentReviews.length === 0) && (
                        <p className="text-center py-8 text-muted-foreground">
                          No review history yet
                        </p>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
