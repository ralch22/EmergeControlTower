import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Building2,
  Target,
  MessageSquare,
  Plus,
  Play,
  Loader2,
  FileText,
} from "lucide-react";

type Client = {
  id: number;
  name: string;
  industry: string;
  targetAudience: string;
  brandVoice: string;
  keywords: string;
  contentGoals: string;
  isActive: boolean;
  createdAt: string;
};

type GeneratedContent = {
  id: number;
  clientId: number;
  type: string;
  title: string;
  status: string;
};

export default function ClientsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    industry: "",
    targetAudience: "",
    brandVoice: "",
    keywords: "",
    contentGoals: "",
  });

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const { data: allContent = [] } = useQuery<GeneratedContent[]>({
    queryKey: ["/api/content"],
    queryFn: async () => {
      const res = await fetch("/api/content");
      if (!res.ok) throw new Error("Failed to fetch content");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newClient) => {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsCreateOpen(false);
      setNewClient({
        name: "",
        industry: "",
        targetAudience: "",
        brandVoice: "",
        keywords: "",
        contentGoals: "",
      });
      toast({
        title: "Client created",
        description: "New client has been added successfully",
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

  const runContentFactoryMutation = useMutation({
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
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-runs"] });
      toast({
        title: "Content Factory started",
        description: `Run ${data.runId} has been initiated`,
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

  const getContentCountForClient = (clientId: number) => {
    return allContent.filter((c) => c.clientId === clientId).length;
  };

  const getContentPillars = (keywords: string) => {
    if (!keywords) return [];
    return keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  };

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.industry) {
      toast({
        title: "Validation error",
        description: "Name and Industry are required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newClient);
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen bg-zinc-950"
        data-testid="loading-clients"
      >
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-3xl font-bold text-cyan-400 flex items-center gap-3"
              data-testid="text-page-title"
            >
              <Users className="w-8 h-8" />
              Clients
            </h1>
            <p className="text-zinc-400 mt-1">
              Manage your content factory clients
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-cyan-600 hover:bg-cyan-500"
                data-testid="button-add-client"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Client
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-700 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-cyan-400">
                  Add New Client
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateClient} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-zinc-300">
                    Client Name *
                  </Label>
                  <Input
                    id="name"
                    value={newClient.name}
                    onChange={(e) =>
                      setNewClient({ ...newClient, name: e.target.value })
                    }
                    placeholder="e.g., Acme Corporation"
                    className="bg-zinc-800 border-zinc-700 text-white"
                    data-testid="input-client-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry" className="text-zinc-300">
                    Industry *
                  </Label>
                  <Input
                    id="industry"
                    value={newClient.industry}
                    onChange={(e) =>
                      setNewClient({ ...newClient, industry: e.target.value })
                    }
                    placeholder="e.g., Technology, Healthcare, Finance"
                    className="bg-zinc-800 border-zinc-700 text-white"
                    data-testid="input-client-industry"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetAudience" className="text-zinc-300">
                    Target Audience
                  </Label>
                  <Input
                    id="targetAudience"
                    value={newClient.targetAudience}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        targetAudience: e.target.value,
                      })
                    }
                    placeholder="e.g., CTOs, Marketing Directors, Small Business Owners"
                    className="bg-zinc-800 border-zinc-700 text-white"
                    data-testid="input-client-target-audience"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brandVoice" className="text-zinc-300">
                    Brand Voice
                  </Label>
                  <Textarea
                    id="brandVoice"
                    value={newClient.brandVoice}
                    onChange={(e) =>
                      setNewClient({ ...newClient, brandVoice: e.target.value })
                    }
                    placeholder="Describe the tone, style, and personality of the brand's communication..."
                    className="bg-zinc-800 border-zinc-700 text-white min-h-[80px]"
                    data-testid="input-client-brand-voice"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keywords" className="text-zinc-300">
                    Content Pillars (comma-separated)
                  </Label>
                  <Input
                    id="keywords"
                    value={newClient.keywords}
                    onChange={(e) =>
                      setNewClient({ ...newClient, keywords: e.target.value })
                    }
                    placeholder="e.g., AI Innovation, Digital Transformation, Leadership"
                    className="bg-zinc-800 border-zinc-700 text-white"
                    data-testid="input-client-keywords"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contentGoals" className="text-zinc-300">
                    Content Goals (comma-separated)
                  </Label>
                  <Input
                    id="contentGoals"
                    value={newClient.contentGoals}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        contentGoals: e.target.value,
                      })
                    }
                    placeholder="e.g., Brand Awareness, Lead Generation, Thought Leadership"
                    className="bg-zinc-800 border-zinc-700 text-white"
                    data-testid="input-client-content-goals"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                    className="border-zinc-700 hover:bg-zinc-800"
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-cyan-600 hover:bg-cyan-500"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-client"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Create Client
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {clients.length === 0 ? (
          <Card
            className="bg-zinc-900 border-zinc-700"
            data-testid="empty-clients-state"
          >
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="w-16 h-16 text-zinc-600 mb-4" />
              <h3 className="text-xl font-semibold text-zinc-400 mb-2">
                No clients yet
              </h3>
              <p className="text-zinc-500 mb-6 text-center max-w-md">
                Add your first client to start generating content with the
                Content Factory
              </p>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="bg-cyan-600 hover:bg-cyan-500"
                data-testid="button-add-first-client"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Client
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => {
              const contentCount = getContentCountForClient(client.id);
              const pillars = getContentPillars(client.keywords);
              const isRunning =
                runContentFactoryMutation.isPending &&
                runContentFactoryMutation.variables === client.id;

              return (
                <Card
                  key={client.id}
                  className="bg-zinc-900 border-zinc-700 hover:border-cyan-500/50 transition-colors"
                  data-testid={`card-client-${client.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle
                          className="text-lg text-white flex items-center gap-2"
                          data-testid={`text-client-name-${client.id}`}
                        >
                          <Building2 className="w-5 h-5 text-cyan-400" />
                          {client.name}
                        </CardTitle>
                        <p
                          className="text-sm text-zinc-400 mt-1"
                          data-testid={`text-client-industry-${client.id}`}
                        >
                          {client.industry}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                        data-testid={`badge-content-count-${client.id}`}
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        {contentCount}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {client.targetAudience && (
                      <div className="flex items-start gap-2">
                        <Target className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                        <p
                          className="text-sm text-zinc-300"
                          data-testid={`text-client-audience-${client.id}`}
                        >
                          {client.targetAudience}
                        </p>
                      </div>
                    )}

                    {client.brandVoice && (
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                        <p
                          className="text-sm text-zinc-400 line-clamp-2"
                          data-testid={`text-client-voice-${client.id}`}
                        >
                          {client.brandVoice}
                        </p>
                      </div>
                    )}

                    {pillars.length > 0 && (
                      <div
                        className="flex flex-wrap gap-1.5"
                        data-testid={`badges-pillars-${client.id}`}
                      >
                        {pillars.slice(0, 5).map((pillar, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="bg-zinc-800 text-zinc-300 border-zinc-600 text-xs"
                            data-testid={`badge-pillar-${client.id}-${index}`}
                          >
                            {pillar}
                          </Badge>
                        ))}
                        {pillars.length > 5 && (
                          <Badge
                            variant="outline"
                            className="bg-zinc-800 text-zinc-500 border-zinc-600 text-xs"
                          >
                            +{pillars.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}

                    <Button
                      onClick={() => runContentFactoryMutation.mutate(client.id)}
                      disabled={isRunning}
                      className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400"
                      data-testid={`button-run-factory-${client.id}`}
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Run Content Factory
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
