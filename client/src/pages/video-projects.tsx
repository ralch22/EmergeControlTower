import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Video, 
  Play, 
  RefreshCw, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Download,
  Film,
  Music,
  Layers,
  Settings,
  Sparkles,
  Trash2,
  Image as ImageIcon,
  StopCircle
} from "lucide-react";
import { Link } from "wouter";

type VideoProjectApiResponse = {
  project: {
    projectId: string;
    title: string;
    description?: string;
    status: string;
    totalDuration?: number;
    outputUrl?: string;
    createdAt: string;
  };
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

type VideoIngredient = {
  ingredientId: string;
  projectId: string;
  title: string;
  description?: string;
  status: string;
  scenes: string;
  voiceoverScript?: string;
  voiceStyle?: string;
  aspectRatio: string;
  resolution: string;
  createdAt: string;
};

type SceneInput = {
  prompt: string;
  duration: number;
  imageUrl: string;
};

type Client = {
  id: number;
  name: string;
  industry: string;
};

type GeneratedContent = {
  contentId: string;
  clientId: number;
  type: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  generating: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ready: "bg-green-500/20 text-green-400 border-green-500/30",
  exported: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  draft: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  generating: <Loader2 className="w-3 h-3 animate-spin" />,
  ready: <CheckCircle2 className="w-3 h-3" />,
  exported: <Download className="w-3 h-3" />,
  failed: <XCircle className="w-3 h-3" />,
  draft: <Clock className="w-3 h-3" />,
  processing: <Loader2 className="w-3 h-3 animate-spin" />,
};

const voiceStyles = [
  { value: "professional_male", label: "Professional Male" },
  { value: "professional_female", label: "Professional Female" },
  { value: "warm_male", label: "Warm Male" },
  { value: "warm_female", label: "Warm Female" },
  { value: "energetic", label: "Energetic" },
  { value: "calm", label: "Calm" },
];

export default function VideoProjectsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(false);
  const [isCreateFromContentOpen, setIsCreateFromContentOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<VideoProject | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedContentId, setSelectedContentId] = useState<string>("");
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    script: "",
  });
  const [provider, setProvider] = useState<"runway" | "wan">("runway");

  const [ingredients, setIngredients] = useState({
    title: "",
    description: "",
    scenes: [{ prompt: "", duration: 6, imageUrl: "" }] as SceneInput[],
    voiceoverScript: "",
    voiceStyle: "professional_male",
    aspectRatio: "16:9",
    resolution: "1080p",
  });

  const { data: projects = [], isLoading } = useQuery<VideoProjectApiResponse[], Error, VideoProject[]>({
    queryKey: ["/api/video-projects"],
    refetchInterval: 5000,
    select: (data) => data.map(item => ({
      ...item.project,
      scenes: item.scenes ?? [],
      clips: item.clips ?? [],
      audioTracks: item.audioTracks ?? [],
    })),
  });

  const { data: videoIngredients = [] } = useQuery<VideoIngredient[]>({
    queryKey: ["/api/video-ingredients"],
    refetchInterval: 5000,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: approvedContent = [] } = useQuery<GeneratedContent[]>({
    queryKey: ["/api/content", selectedClientId],
    enabled: !!selectedClientId,
    select: (data) => data.filter(c => c.status === "approved"),
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newProject) => {
      const res = await fetch("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects"] });
      setIsCreateOpen(false);
      setNewProject({ title: "", description: "", script: "" });
      toast({ title: "Project created", description: "Video project has been created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createIngredientsMutation = useMutation({
    mutationFn: async (data: typeof ingredients) => {
      const scenesForApi = data.scenes.map((scene, index) => ({
        prompt: scene.prompt,
        duration: scene.duration,
        imageUrl: scene.imageUrl || undefined,
        order: index,
        transition: "fade",
      }));
      
      const res = await fetch("/api/video-ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          scenes: scenesForApi,
          voiceoverScript: data.voiceoverScript,
          voiceStyle: data.voiceStyle,
          aspectRatio: data.aspectRatio,
          resolution: data.resolution,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-ingredients"] });
      setIsIngredientsOpen(false);
      setIngredients({
        title: "",
        description: "",
        scenes: [{ prompt: "", duration: 6, imageUrl: "" }],
        voiceoverScript: "",
        voiceStyle: "professional_male",
        aspectRatio: "16:9",
        resolution: "1080p",
      });
      toast({ title: "Ingredients created", description: "Video ingredients bundle has been created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generateIngredientsMutation = useMutation({
    mutationFn: async (ingredientId: string) => {
      const res = await fetch(`/api/video-ingredients/${ingredientId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects"] });
      toast({ title: "Generation started", description: "Video generation from ingredients has been initiated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`/api/video-projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects"] });
      toast({ title: "Generation started", description: "Video generation has been initiated" });
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
        body: JSON.stringify({ provider }),
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

  const exportMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`/api/video-projects/${projectId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects"] });
      toast({ title: "Export started", description: "Video export has been initiated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`/api/video-projects/${projectId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects"] });
      toast({ title: "Cancelled", description: "Video generation has been stopped" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/video-projects/clear", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear video projects");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/video-ingredients"] });
      toast({ 
        title: "Cleared", 
        description: `Removed ${data.deletedCount || 0} video projects` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createTestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/video-projects/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects"] });
      toast({ title: "Test project created", description: "Ready to start video generation with 3 sample scenes" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createFromContentMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const res = await fetch("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, clientId: parseInt(selectedClientId) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects"] });
      setIsCreateFromContentOpen(false);
      setSelectedClientId("");
      setSelectedContentId("");
      toast({ title: "Video project created", description: "Project created from approved content. Ready to generate!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getProjectStats = (project: VideoProject) => {
    const scenes = project.scenes || [];
    const clips = project.clips || [];
    const audioTracks = project.audioTracks || [];
    
    const readyScenes = scenes.filter(s => s.status === "ready").length;
    const failedScenes = scenes.filter(s => s.status === "failed").length;
    const readyClips = clips.filter(c => c.status === "ready").length;
    const failedClips = clips.filter(c => c.status === "failed").length;
    const readyAudio = audioTracks.filter(a => a.status === "ready").length;
    const failedAudio = audioTracks.filter(a => a.status === "failed").length;

    return {
      scenes: { ready: readyScenes, failed: failedScenes, total: scenes.length },
      clips: { ready: readyClips, failed: failedClips, total: clips.length },
      audio: { ready: readyAudio, failed: failedAudio, total: audioTracks.length },
    };
  };

  const canRegenerate = (project: VideoProject) => {
    const scenes = project.scenes || [];
    const clips = project.clips || [];
    const audioTracks = project.audioTracks || [];
    
    return project.status === "failed" || 
      scenes.some(s => s.status === "failed") ||
      clips.some(c => c.status === "failed") ||
      audioTracks.some(a => a.status === "failed");
  };

  const canExport = (project: VideoProject) => {
    const clips = project.clips || [];
    return clips.length > 0 && clips.every(c => c.status === "ready");
  };

  const addScene = () => {
    setIngredients({
      ...ingredients,
      scenes: [...ingredients.scenes, { prompt: "", duration: 6, imageUrl: "" }],
    });
  };

  const removeScene = (index: number) => {
    if (ingredients.scenes.length > 1) {
      const newScenes = ingredients.scenes.filter((_, i) => i !== index);
      setIngredients({ ...ingredients, scenes: newScenes });
    }
  };

  const updateScene = (index: number, field: keyof SceneInput, value: string | number) => {
    const newScenes = [...ingredients.scenes];
    newScenes[index] = { ...newScenes[index], [field]: value };
    setIngredients({ ...ingredients, scenes: newScenes });
  };

  const getIngredientsSceneCount = (ing: VideoIngredient) => {
    try {
      const scenes = JSON.parse(ing.scenes || "[]");
      return scenes.length;
    } catch {
      return 0;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400 flex items-center gap-3">
              <Video className="w-8 h-8" />
              Video Projects
            </h1>
            <p className="text-zinc-400 mt-1">AI-powered video production pipeline</p>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" className="border-zinc-700 hover:bg-zinc-800" data-testid="link-dashboard">
                <Layers className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="outline" className="border-zinc-700 hover:bg-zinc-800" data-testid="link-settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>

            <Button 
              className="bg-green-600 hover:bg-green-500"
              onClick={() => setIsCreateFromContentOpen(true)}
              disabled={clients.length === 0}
              data-testid="button-create-from-content"
            >
              <Film className="w-4 h-4 mr-2" />
              From Content
            </Button>

            <Button 
              className="bg-purple-600 hover:bg-purple-500"
              onClick={() => createTestMutation.mutate()}
              disabled={createTestMutation.isPending}
              data-testid="button-create-test-project"
            >
              {createTestMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Create Test Project
            </Button>

            <Button 
              variant="outline" 
              className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-500"
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending || (projects.length === 0 && videoIngredients.length === 0)}
              data-testid="button-clear-all-projects"
            >
              {clearAllMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Clear All
            </Button>

            <Select value={provider} onValueChange={(v: "runway" | "wan") => setProvider(v)}>
              <SelectTrigger className="w-32 bg-zinc-900 border-zinc-700" data-testid="select-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="runway">Runway</SelectItem>
                <SelectItem value="wan">Wan</SelectItem>
              </SelectContent>
            </Select>

            <Dialog open={isCreateFromContentOpen} onOpenChange={setIsCreateFromContentOpen}>
              <DialogContent className="bg-zinc-900 border-zinc-700 max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-cyan-400">Create Video from Approved Content</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Select Client</Label>
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="select-client-for-video">
                        <SelectValue placeholder="Choose a client..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {client.name} ({client.industry})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedClientId && (
                    <div>
                      <Label>Select Approved Content</Label>
                      {approvedContent.length === 0 ? (
                        <div className="p-3 bg-zinc-800 rounded border border-zinc-700 text-zinc-400 text-sm">
                          No approved content available for this client
                        </div>
                      ) : (
                        <Select value={selectedContentId} onValueChange={setSelectedContentId}>
                          <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="select-content-for-video">
                            <SelectValue placeholder="Choose content..." />
                          </SelectTrigger>
                          <SelectContent>
                            {approvedContent.map((content) => (
                              <SelectItem key={content.contentId} value={content.contentId}>
                                {content.title} ({content.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 justify-end pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreateFromContentOpen(false);
                        setSelectedClientId("");
                        setSelectedContentId("");
                      }}
                      className="border-zinc-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-500"
                      onClick={() => createFromContentMutation.mutate(selectedContentId)}
                      disabled={!selectedClientId || !selectedContentId || createFromContentMutation.isPending}
                      data-testid="button-create-from-content-confirm"
                    >
                      {createFromContentMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Film className="w-4 h-4 mr-2" />
                      )}
                      Create Video Project
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-cyan-600 hover:bg-cyan-500" data-testid="button-create-project">
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-700 max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-cyan-400">Create Video Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={newProject.title}
                      onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                      placeholder="My Video Project"
                      className="bg-zinc-800 border-zinc-700"
                      data-testid="input-project-title"
                    />
                  </div>
                  <div>
                    <Label>Description (optional)</Label>
                    <Input
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      placeholder="Brief description of the video"
                      className="bg-zinc-800 border-zinc-700"
                      data-testid="input-project-description"
                    />
                  </div>
                  <div>
                    <Label>Video Script</Label>
                    <Textarea
                      value={newProject.script}
                      onChange={(e) => setNewProject({ ...newProject, script: e.target.value })}
                      placeholder="Enter your video script with scene markers like [SCENE 1: Title]..."
                      className="bg-zinc-800 border-zinc-700 min-h-[200px]"
                      data-testid="input-project-script"
                    />
                  </div>
                  <Button
                    onClick={() => createMutation.mutate(newProject)}
                    disabled={!newProject.title || !newProject.script || createMutation.isPending}
                    className="w-full bg-cyan-600 hover:bg-cyan-500"
                    data-testid="button-submit-project"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Create Project
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isIngredientsOpen} onOpenChange={setIsIngredientsOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-500" data-testid="button-ingredients-to-video">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Ingredients to Video
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-700 max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-cyan-400 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Ingredients to Video
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={ingredients.title}
                        onChange={(e) => setIngredients({ ...ingredients, title: e.target.value })}
                        placeholder="My Video"
                        className="bg-zinc-800 border-zinc-700"
                        data-testid="input-ingredients-title"
                      />
                    </div>
                    <div>
                      <Label>Description (optional)</Label>
                      <Input
                        value={ingredients.description}
                        onChange={(e) => setIngredients({ ...ingredients, description: e.target.value })}
                        placeholder="Brief description"
                        className="bg-zinc-800 border-zinc-700"
                        data-testid="input-ingredients-description"
                      />
                    </div>
                  </div>

                  <div className="border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <Label className="text-lg flex items-center gap-2">
                        <Layers className="w-4 h-4 text-cyan-400" />
                        Scene Builder
                      </Label>
                      <Button
                        type="button"
                        size="sm"
                        onClick={addScene}
                        className="bg-cyan-600 hover:bg-cyan-500"
                        data-testid="button-add-scene"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Scene
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      {ingredients.scenes.map((scene, index) => (
                        <div key={index} className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-cyan-400 font-mono text-sm">Scene {index + 1}</span>
                            {ingredients.scenes.length > 1 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeScene(index)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                data-testid={`button-remove-scene-${index}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs text-zinc-400">Visual Prompt</Label>
                              <Textarea
                                value={scene.prompt}
                                onChange={(e) => updateScene(index, "prompt", e.target.value)}
                                placeholder="Describe the visual scene..."
                                className="bg-zinc-900 border-zinc-600 min-h-[80px]"
                                data-testid={`input-scene-prompt-${index}`}
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-zinc-400">Duration (seconds)</Label>
                                <Select
                                  value={String(scene.duration)}
                                  onValueChange={(v) => updateScene(index, "duration", parseInt(v))}
                                >
                                  <SelectTrigger className="bg-zinc-900 border-zinc-600" data-testid={`select-scene-duration-${index}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="5">5 seconds</SelectItem>
                                    <SelectItem value="6">6 seconds</SelectItem>
                                    <SelectItem value="7">7 seconds</SelectItem>
                                    <SelectItem value="8">8 seconds</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div>
                                <Label className="text-xs text-zinc-400 flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3" />
                                  Reference Image URL (optional)
                                </Label>
                                <Input
                                  value={scene.imageUrl}
                                  onChange={(e) => updateScene(index, "imageUrl", e.target.value)}
                                  placeholder="https://..."
                                  className="bg-zinc-900 border-zinc-600"
                                  data-testid={`input-scene-image-${index}`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-zinc-700 rounded-lg p-4">
                    <Label className="text-lg flex items-center gap-2 mb-4">
                      <Music className="w-4 h-4 text-cyan-400" />
                      Voiceover
                    </Label>
                    
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs text-zinc-400">Full Voiceover Script</Label>
                        <Textarea
                          value={ingredients.voiceoverScript}
                          onChange={(e) => setIngredients({ ...ingredients, voiceoverScript: e.target.value })}
                          placeholder="Enter the complete voiceover script that will play over the video..."
                          className="bg-zinc-800 border-zinc-700 min-h-[100px]"
                          data-testid="input-voiceover-script"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs text-zinc-400">Voice Style</Label>
                        <Select
                          value={ingredients.voiceStyle}
                          onValueChange={(v) => setIngredients({ ...ingredients, voiceStyle: v })}
                        >
                          <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="select-voice-style">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {voiceStyles.map((style) => (
                              <SelectItem key={style.value} value={style.value}>
                                {style.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="border border-zinc-700 rounded-lg p-4">
                    <Label className="text-lg flex items-center gap-2 mb-4">
                      <Settings className="w-4 h-4 text-cyan-400" />
                      Output Settings
                    </Label>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-zinc-400">Aspect Ratio</Label>
                        <Select
                          value={ingredients.aspectRatio}
                          onValueChange={(v) => setIngredients({ ...ingredients, aspectRatio: v })}
                        >
                          <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="select-aspect-ratio">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                            <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-xs text-zinc-400">Resolution</Label>
                        <Select
                          value={ingredients.resolution}
                          onValueChange={(v) => setIngredients({ ...ingredients, resolution: v })}
                        >
                          <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="select-resolution">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="720p">720p</SelectItem>
                            <SelectItem value="1080p">1080p</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => createIngredientsMutation.mutate(ingredients)}
                    disabled={
                      !ingredients.title || 
                      ingredients.scenes.length === 0 || 
                      ingredients.scenes.some(s => !s.prompt) ||
                      createIngredientsMutation.isPending
                    }
                    className="w-full bg-purple-600 hover:bg-purple-500"
                    data-testid="button-submit-ingredients"
                  >
                    {createIngredientsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Create Ingredients Bundle
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {videoIngredients.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-purple-400 flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5" />
              Video Ingredients
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videoIngredients.map((ing) => (
                <Card 
                  key={ing.ingredientId}
                  className="bg-zinc-900 border-zinc-700 hover:border-purple-500/50 transition-colors"
                  data-testid={`card-ingredient-${ing.ingredientId}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg text-white truncate">
                        {ing.title}
                      </CardTitle>
                      <Badge className={`${statusColors[ing.status]} flex items-center gap-1`}>
                        {statusIcons[ing.status]}
                        {ing.status}
                      </Badge>
                    </div>
                    {ing.description && (
                      <p className="text-sm text-zinc-400 truncate">{ing.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                      <div className="flex items-center gap-1">
                        <Layers className="w-4 h-4" />
                        <span>{getIngredientsSceneCount(ing)} scenes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Film className="w-4 h-4" />
                        <span>{ing.aspectRatio}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{ing.resolution}</span>
                      </div>
                    </div>
                    
                    {ing.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => generateIngredientsMutation.mutate(ing.ingredientId)}
                        disabled={generateIngredientsMutation.isPending}
                        className="w-full bg-purple-600 hover:bg-purple-500"
                        data-testid={`button-generate-ingredient-${ing.ingredientId}`}
                      >
                        {generateIngredientsMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        Generate Video
                      </Button>
                    )}
                    
                    {ing.status === "processing" && (
                      <div className="flex items-center justify-center gap-2 text-blue-400 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Generating...</span>
                      </div>
                    )}
                    
                    {ing.status === "ready" && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 w-full justify-center py-2">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Video Ready
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {projects.length === 0 && videoIngredients.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-700">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Video className="w-16 h-16 text-zinc-600 mb-4" />
              <h3 className="text-xl font-semibold text-zinc-400">No video projects yet</h3>
              <p className="text-zinc-500 mt-2">Create your first AI-powered video project</p>
            </CardContent>
          </Card>
        ) : projects.length > 0 && (
          <>
            <h2 className="text-xl font-semibold text-cyan-400 flex items-center gap-2 mb-4">
              <Video className="w-5 h-5" />
              Video Projects
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => {
                const stats = getProjectStats(project);
                const hasFailed = canRegenerate(project);
                const isGenerating = project.status === "generating";

                return (
                  <Card 
                    key={project.projectId} 
                    className="bg-zinc-900 border-zinc-700 hover:border-zinc-600 transition-colors"
                    data-testid={`card-project-${project.projectId}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg text-white truncate">
                          {project.title}
                        </CardTitle>
                        <Badge className={`${statusColors[project.status]} flex items-center gap-1`}>
                          {statusIcons[project.status]}
                          {project.status}
                        </Badge>
                      </div>
                      {project.description && (
                        <p className="text-sm text-zinc-400 truncate">{project.description}</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Layers className="w-4 h-4" />
                          <span>{stats.scenes.ready}/{stats.scenes.total}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Film className="w-4 h-4" />
                          <span>{stats.clips.ready}/{stats.clips.total}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Music className="w-4 h-4" />
                          <span>{stats.audio.ready}/{stats.audio.total}</span>
                        </div>
                      </div>

                      {project.totalDuration && (
                        <div className="flex items-center gap-2 text-zinc-400 text-sm">
                          <Clock className="w-4 h-4" />
                          <span>{project.totalDuration}s total duration</span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {project.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => generateMutation.mutate(project.projectId)}
                            disabled={generateMutation.isPending}
                            className="flex-1 bg-cyan-600 hover:bg-cyan-500"
                            data-testid={`button-generate-${project.projectId}`}
                          >
                            {generateMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Play className="w-4 h-4 mr-2" />
                            )}
                            Generate
                          </Button>
                        )}

                        {isGenerating && (
                          <Button
                            size="sm"
                            onClick={() => cancelMutation.mutate(project.projectId)}
                            disabled={cancelMutation.isPending}
                            className="flex-1 bg-red-600 hover:bg-red-500"
                            data-testid={`button-cancel-${project.projectId}`}
                          >
                            {cancelMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <StopCircle className="w-4 h-4 mr-2" />
                            )}
                            Stop
                          </Button>
                        )}

                        {hasFailed && !isGenerating && (
                          <Button
                            size="sm"
                            onClick={() => regenerateMutation.mutate(project.projectId)}
                            disabled={regenerateMutation.isPending}
                            className="flex-1 bg-orange-600 hover:bg-orange-500"
                            data-testid={`button-regenerate-${project.projectId}`}
                          >
                            {regenerateMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            Retry Failed
                          </Button>
                        )}

                        {canExport(project) && project.status !== "exported" && (
                          <Button
                            size="sm"
                            onClick={() => exportMutation.mutate(project.projectId)}
                            disabled={exportMutation.isPending}
                            className="flex-1 bg-purple-600 hover:bg-purple-500"
                            data-testid={`button-export-${project.projectId}`}
                          >
                            {exportMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Download className="w-4 h-4 mr-2" />
                            )}
                            Export
                          </Button>
                        )}

                        {project.outputUrl && (
                          <Button
                            size="sm"
                            asChild
                            className="flex-1 bg-green-600 hover:bg-green-500"
                            data-testid={`button-download-${project.projectId}`}
                          >
                            <a href={project.outputUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </a>
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedProject(project)}
                          className="border-zinc-600 hover:bg-zinc-800"
                          data-testid={`button-details-${project.projectId}`}
                        >
                          Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
          <DialogContent className="bg-zinc-900 border-zinc-700 max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-cyan-400">{selectedProject?.title}</DialogTitle>
            </DialogHeader>
            {selectedProject && (
              <div className="space-y-6 mt-4">
                <div className="flex items-center gap-4">
                  <Badge className={statusColors[selectedProject.status]}>
                    {selectedProject.status}
                  </Badge>
                  {selectedProject.totalDuration && (
                    <span className="text-zinc-400 text-sm">
                      {selectedProject.totalDuration}s duration
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-3">Scenes</h4>
                  <div className="space-y-2">
                    {(selectedProject.scenes || []).map((scene) => {
                      const clips = selectedProject.clips || [];
                      const audioTracks = selectedProject.audioTracks || [];
                      const clip = clips.find(c => c.sceneId === scene.sceneId);
                      const audio = audioTracks.find(a => a.sceneId === scene.sceneId);

                      return (
                        <div
                          key={scene.sceneId}
                          className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-cyan-400 font-mono text-sm">
                              #{scene.sceneNumber}
                            </span>
                            <span className="text-white">{scene.title}</span>
                            <span className="text-zinc-500 text-sm">{scene.duration}s</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs ${statusColors[clip?.status || 'pending']}`}>
                              <Film className="w-3 h-3 mr-1" />
                              {clip?.status || 'pending'}
                            </Badge>
                            <Badge className={`text-xs ${statusColors[audio?.status || 'pending']}`}>
                              <Music className="w-3 h-3 mr-1" />
                              {audio?.status || 'pending'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {canRegenerate(selectedProject) && selectedProject.status !== "generating" && (
                  <Button
                    onClick={() => {
                      regenerateMutation.mutate(selectedProject.projectId);
                      setSelectedProject(null);
                    }}
                    className="w-full bg-orange-600 hover:bg-orange-500"
                    data-testid="button-regenerate-modal"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Failed Items
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
