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
  Layers
} from "lucide-react";

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

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  generating: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ready: "bg-green-500/20 text-green-400 border-green-500/30",
  exported: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  generating: <Loader2 className="w-3 h-3 animate-spin" />,
  ready: <CheckCircle2 className="w-3 h-3" />,
  exported: <Download className="w-3 h-3" />,
  failed: <XCircle className="w-3 h-3" />,
};

export default function VideoProjectsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<VideoProject | null>(null);
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    script: "",
  });
  const [provider, setProvider] = useState<"runway" | "wan">("runway");

  const { data: projects = [], isLoading } = useQuery<VideoProject[]>({
    queryKey: ["/api/video-projects"],
    refetchInterval: 5000,
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
            <Select value={provider} onValueChange={(v: "runway" | "wan") => setProvider(v)}>
              <SelectTrigger className="w-32 bg-zinc-900 border-zinc-700" data-testid="select-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="runway">Runway</SelectItem>
                <SelectItem value="wan">Wan</SelectItem>
              </SelectContent>
            </Select>

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
          </div>
        </div>

        {projects.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-700">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Video className="w-16 h-16 text-zinc-600 mb-4" />
              <h3 className="text-xl font-semibold text-zinc-400">No video projects yet</h3>
              <p className="text-zinc-500 mt-2">Create your first AI-powered video project</p>
            </CardContent>
          </Card>
        ) : (
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
