import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Film, Play, Pause, RefreshCw, CheckCircle, XCircle, Clock, 
  AlertTriangle, Download, ChevronLeft, Video, Mic, Image,
  Zap, SkipForward, Loader2, ExternalLink, Wand2, Sparkles, Volume2
} from "lucide-react";

const ShotstackStudio = lazy(() => import("@/components/ShotstackStudio"));

interface SceneStatus {
  sceneNumber: number;
  sceneId: string;
  duration: number;
  visualDescription: string;
  voiceoverText: string;
  referenceImageUrl: string | null;
  clip: {
    status: string;
    provider: string;
    videoUrl: string | null;
    errorMessage: string | null;
  } | null;
  audio: {
    status: string;
    provider: string;
    audioUrl: string | null;
    errorMessage: string | null;
  } | null;
  isReady: boolean;
}

interface AssemblyStatus {
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  outputUrl: string | null;
  totalScenes: number;
  readyCount: number;
  failedCount: number;
  pendingCount: number;
  canForceAssemble: boolean;
  estimatedDuration: number;
  scenes: SceneStatus[];
}

interface VideoProjectResponse {
  project: {
    projectId: string;
    title: string;
    status: string;
    outputUrl: string | null;
  };
  scenes: any[];
  clips: any[];
  audioTracks: any[];
}

interface VideoProject {
  projectId: string;
  title: string;
  status: string;
  outputUrl: string | null;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'ready': 
    case 'completed': return 'bg-green-500';
    case 'generating': return 'bg-yellow-500 animate-pulse';
    case 'failed': return 'bg-red-500';
    case 'pending': return 'bg-zinc-500';
    default: return 'bg-zinc-600';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'ready': 
    case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'generating': return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
    case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
    case 'pending': return <Clock className="w-4 h-4 text-zinc-400" />;
    default: return <Clock className="w-4 h-4 text-zinc-500" />;
  }
}

function SceneCard({ scene, onRetry }: { scene: SceneStatus; onRetry?: () => void }) {
  const [showPreview, setShowPreview] = useState(false);
  
  return (
    <Card className={`bg-zinc-900/50 border ${scene.isReady ? 'border-green-500/30' : scene.clip?.status === 'failed' ? 'border-red-500/30' : 'border-zinc-700'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
            {scene.referenceImageUrl ? (
              <img 
                src={scene.referenceImageUrl} 
                alt={`Scene ${scene.sceneNumber}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image className="w-6 h-6 text-zinc-600" />
              </div>
            )}
            <div className="absolute top-1 left-1">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-black/60">
                {scene.sceneNumber}
              </Badge>
            </div>
            {scene.clip?.videoUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                onClick={() => setShowPreview(true)}
              >
                <Play className="w-6 h-6 text-white" />
              </Button>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-white">Scene {scene.sceneNumber}</span>
              <Badge variant="outline" className="text-[10px]">
                {scene.duration}s
              </Badge>
              {scene.clip?.provider && (
                <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-500/30">
                  {scene.clip.provider}
                </Badge>
              )}
            </div>
            
            <p className="text-xs text-zinc-400 line-clamp-2 mb-2">
              {scene.visualDescription}
            </p>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Video className="w-3 h-3" />
                {getStatusIcon(scene.clip?.status || 'pending')}
                <span className="text-[10px] text-zinc-500 uppercase">
                  {scene.clip?.status || 'no clip'}
                </span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <Mic className="w-3 h-3" />
                {getStatusIcon(scene.audio?.status || 'pending')}
                <span className="text-[10px] text-zinc-500 uppercase">
                  {scene.audio?.status || 'no audio'}
                </span>
              </div>
            </div>
            
            {scene.clip?.errorMessage && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400">
                {scene.clip.errorMessage.substring(0, 100)}...
              </div>
            )}
          </div>
          
          {scene.clip?.status === 'failed' && onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="flex-shrink-0">
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          )}
        </div>
      </CardContent>
      
      {showPreview && scene.clip?.videoUrl && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-700">
            <DialogHeader>
              <DialogTitle>Scene {scene.sceneNumber} Preview</DialogTitle>
            </DialogHeader>
            <video 
              src={scene.clip.videoUrl} 
              controls 
              autoPlay 
              className="w-full rounded-lg"
            />
            {scene.audio?.audioUrl && (
              <div className="mt-2">
                <span className="text-xs text-zinc-400">Voiceover:</span>
                <audio src={scene.audio.audioUrl} controls className="w-full mt-1" />
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

interface QuickVideoResult {
  success: boolean;
  videoUrl?: string;
  duration?: number;
  hasAudio?: boolean;
  model?: string;
  error?: string;
  processingTimeMs?: number;
}

function QuickVideoGenerator() {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<'veo-3.0' | 'veo-3.1' | 'veo-3.1-fast'>('veo-3.1-fast');
  const [duration, setDuration] = useState<4 | 6 | 8>(8);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [style, setStyle] = useState("");
  const [result, setResult] = useState<QuickVideoResult | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/video/quick-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model,
          duration,
          aspectRatio,
          style: style || undefined,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate video');
      }
      return res.json() as Promise<QuickVideoResult>;
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setResult(null);
    generateMutation.mutate();
  };

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gradient-to-br from-violet-900/30 to-cyan-900/30 border-violet-500/30 hover:border-violet-500/50 transition-all cursor-pointer group" data-testid="quick-video-card">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  Quick Video with Veo 3
                  <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30">New</Badge>
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Generate a single 8-second video with native audio. No multi-scene assembly needed.
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3 h-3" />
                    Built-in audio
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Single shot
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-zinc-900 border-zinc-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            Quick Video Generator
          </DialogTitle>
          <DialogDescription>
            Generate a single video clip with native audio using Google Veo 3. No multi-scene complexity.
          </DialogDescription>
        </DialogHeader>

        {result?.success && result.videoUrl ? (
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden bg-black">
              <video 
                src={result.videoUrl} 
                controls 
                autoPlay 
                className="w-full"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4 text-zinc-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {result.duration}s
                </span>
                {result.hasAudio && (
                  <span className="flex items-center gap-1 text-green-400">
                    <Volume2 className="w-4 h-4" />
                    Has audio
                  </span>
                )}
                <Badge variant="outline">{result.model}</Badge>
              </div>
              <Button size="sm" variant="outline" asChild>
                <a href={result.videoUrl} download target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </a>
              </Button>
            </div>
            {result.processingTimeMs && (
              <p className="text-xs text-zinc-500 text-center">
                Generated in {Math.round(result.processingTimeMs / 1000)}s
              </p>
            )}
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : result?.error ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Generation Failed</p>
                  <p className="text-sm text-zinc-400 mt-1">{result.error}</p>
                </div>
              </div>
            </div>
            <Button onClick={() => setResult(null)} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">Video Description</Label>
              <Textarea
                id="prompt"
                placeholder="Describe your video... e.g., 'A drone shot flying over a tropical beach at sunset with gentle waves'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="bg-zinc-800 border-zinc-700"
                data-testid="quick-video-prompt"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={model} onValueChange={(v) => setModel(v as typeof model)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="quick-video-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="veo-3.1-fast">Veo 3.1 Fast (Faster)</SelectItem>
                    <SelectItem value="veo-3.1">Veo 3.1 (Quality)</SelectItem>
                    <SelectItem value="veo-3.0">Veo 3.0 (Premium)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v) as typeof duration)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="quick-video-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 seconds</SelectItem>
                    <SelectItem value="6">6 seconds</SelectItem>
                    <SelectItem value="8">8 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as typeof aspectRatio)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="quick-video-aspect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                    <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="style">Style (Optional)</Label>
                <Input
                  id="style"
                  placeholder="e.g., cinematic, realistic"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="bg-zinc-800 border-zinc-700"
                  data-testid="quick-video-style"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-800/50 text-xs text-zinc-400">
              <p className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-green-400" />
                Veo 3 generates videos with native audio (dialogue, music, sound effects).
              </p>
            </div>

            <Button 
              onClick={handleGenerate}
              disabled={!prompt.trim() || generateMutation.isPending}
              className="w-full bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600"
              data-testid="quick-video-generate"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating... (may take 2-5 min)
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Video
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ContinuousVideoResult {
  success: boolean;
  videoUrl?: string;
  totalDuration?: number;
  hopCount?: number;
  error?: string;
  processingTimeMs?: number;
  sceneResults?: Array<{
    sceneIndex: number;
    prompt: string;
    success: boolean;
    videoUrl?: string;
    error?: string;
  }>;
  estimatedDuration?: number;
}

interface SceneInput {
  prompt: string;
  resetRequired: boolean;
}

function ContinuousVideoGenerator() {
  const [isOpen, setIsOpen] = useState(false);
  const [scenes, setScenes] = useState<SceneInput[]>([{ prompt: "", resetRequired: false }]);
  const [model, setModel] = useState<'veo-3.0' | 'veo-3.1' | 'veo-3.1-fast'>('veo-3.1');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [result, setResult] = useState<ContinuousVideoResult | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const validScenes = scenes.filter(s => s.prompt.trim());
      if (validScenes.length === 0) {
        throw new Error('At least one scene with a prompt is required');
      }
      const res = await fetch('/api/video/continuous-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: validScenes,
          model,
          aspectRatio,
          generateAudio: true,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate video');
      }
      return res.json() as Promise<ContinuousVideoResult>;
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const addScene = () => {
    if (scenes.length >= 20) return;
    setScenes([...scenes, { prompt: "", resetRequired: false }]);
  };

  const removeScene = (index: number) => {
    if (scenes.length <= 1) return;
    setScenes(scenes.filter((_, i) => i !== index));
  };

  const updateScene = (index: number, field: keyof SceneInput, value: string | boolean) => {
    const updated = [...scenes];
    updated[index] = { ...updated[index], [field]: value };
    setScenes(updated);
  };

  const handleGenerate = () => {
    const validScenes = scenes.filter(s => s.prompt.trim());
    if (validScenes.length === 0) return;
    setResult(null);
    generateMutation.mutate();
  };

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
  };

  const estimatedDuration = scenes.length === 1 ? 8 : 8 + (scenes.length - 1) * 7;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="bg-gradient-to-br from-emerald-900/30 to-cyan-900/30 border-emerald-500/30 hover:border-emerald-500/50 transition-all cursor-pointer group" data-testid="continuous-video-card">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 group-hover:scale-110 transition-transform">
                <Film className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  Continuous Video
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Multi-Scene</Badge>
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Generate long videos with visual consistency by extending scenes sequentially.
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <SkipForward className="w-3 h-3" />
                    Up to 148s
                  </span>
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3 h-3" />
                    Native audio
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Visual continuity
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5 text-emerald-400" />
            Continuous Video Generator
          </DialogTitle>
          <DialogDescription>
            Create longer videos with visual consistency. Each scene extends the previous one, maintaining style and characters.
          </DialogDescription>
        </DialogHeader>

        {result?.success && result.videoUrl ? (
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden bg-black">
              <video 
                src={result.videoUrl} 
                controls 
                autoPlay 
                className="w-full"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4 text-zinc-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  ~{result.totalDuration}s
                </span>
                <span className="flex items-center gap-1">
                  <Film className="w-4 h-4" />
                  {result.hopCount} scenes
                </span>
                <Badge variant="outline">{model}</Badge>
              </div>
              <Button size="sm" variant="outline" asChild>
                <a href={result.videoUrl} download target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </a>
              </Button>
            </div>
            {result.sceneResults && (
              <div className="space-y-2 p-3 rounded-lg bg-zinc-800/50">
                <p className="text-xs text-zinc-400 font-medium">Scene Results:</p>
                {result.sceneResults.map((scene, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {scene.success ? (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-400" />
                    )}
                    <span className="text-zinc-400">Scene {scene.sceneIndex + 1}:</span>
                    <span className={scene.success ? 'text-green-400' : 'text-red-400'}>
                      {scene.success ? 'Success' : scene.error?.substring(0, 50)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {result.processingTimeMs && (
              <p className="text-xs text-zinc-500 text-center">
                Generated in {Math.round(result.processingTimeMs / 1000)}s
              </p>
            )}
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : result?.error ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Generation Failed</p>
                  <p className="text-sm text-zinc-400 mt-1">{result.error}</p>
                </div>
              </div>
            </div>
            <Button onClick={() => setResult(null)} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={model} onValueChange={(v) => setModel(v as typeof model)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="continuous-video-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="veo-3.1">Veo 3.1 (Recommended)</SelectItem>
                    <SelectItem value="veo-3.1-fast">Veo 3.1 Fast</SelectItem>
                    <SelectItem value="veo-3.0">Veo 3.0 (Premium)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as typeof aspectRatio)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="continuous-video-aspect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                    <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Scenes ({scenes.length}/20)</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addScene}
                  disabled={scenes.length >= 20}
                  className="h-7 text-xs"
                >
                  + Add Scene
                </Button>
              </div>

              <ScrollArea className="h-[280px] pr-4">
                <div className="space-y-3">
                  {scenes.map((scene, index) => (
                    <div key={index} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-300">
                          Scene {index + 1}
                          {index === 0 && <span className="text-xs text-zinc-500 ml-2">(Base - 8s)</span>}
                          {index > 0 && <span className="text-xs text-zinc-500 ml-2">(Extension - 7s)</span>}
                        </span>
                        {scenes.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeScene(index)}
                            className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <Textarea
                        placeholder="Describe what happens in this scene..."
                        value={scene.prompt}
                        onChange={(e) => updateScene(index, 'prompt', e.target.value)}
                        rows={2}
                        className="bg-zinc-900 border-zinc-700 text-sm"
                        data-testid={`continuous-scene-prompt-${index}`}
                      />
                      {index > 0 && (
                        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={scene.resetRequired}
                            onChange={(e) => updateScene(index, 'resetRequired', e.target.checked)}
                            className="rounded border-zinc-600"
                          />
                          Reset visual style (start fresh instead of extending)
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
              <p className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                Estimated total duration: ~{estimatedDuration} seconds
              </p>
              <p className="text-zinc-400">
                Cost estimate: ~${(estimatedDuration * 0.75).toFixed(2)} with native audio
              </p>
            </div>

            <Button 
              onClick={handleGenerate}
              disabled={scenes.every(s => !s.prompt.trim()) || generateMutation.isPending}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"
              data-testid="continuous-video-generate"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating... (may take {Math.ceil(estimatedDuration / 8) * 2}-{Math.ceil(estimatedDuration / 8) * 5} min)
                </>
              ) : (
                <>
                  <Film className="w-4 h-4 mr-2" />
                  Generate Continuous Video
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProjectSelector({ projects, selectedId, onSelect }: { 
  projects: VideoProject[]; 
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map(project => (
        <Card 
          key={project.projectId}
          className={`cursor-pointer transition-all hover:border-cyan-500/50 ${
            selectedId === project.projectId ? 'border-cyan-500 bg-cyan-500/5' : 'bg-zinc-900/50 border-zinc-700'
          }`}
          onClick={() => onSelect(project.projectId)}
          data-testid={`project-card-${project.projectId}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-white truncate">
                  {project.title}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge 
                    variant={project.status === 'completed' ? 'default' : 'outline'}
                    className={project.status === 'completed' ? 'bg-green-500' : ''}
                  >
                    {project.status}
                  </Badge>
                  {project.outputUrl && (
                    <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">
                      <Video className="w-3 h-3 mr-1" />
                      Has Output
                    </Badge>
                  )}
                </div>
              </div>
              <Film className="w-5 h-5 text-zinc-500" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function VideoAssemblyPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ projectId?: string }>();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(params.projectId || null);
  const queryClient = useQueryClient();
  
  const { data: projects = [], isLoading: projectsLoading } = useQuery<VideoProject[]>({
    queryKey: ['/api/video-projects'],
    queryFn: async () => {
      const res = await fetch('/api/video-projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data: VideoProjectResponse[] = await res.json();
      return data.map(item => ({
        projectId: item.project.projectId,
        title: item.project.title,
        status: item.project.status,
        outputUrl: item.project.outputUrl,
      }));
    },
    refetchInterval: 10000,
  });
  
  const { data: assemblyStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<AssemblyStatus>({
    queryKey: ['/api/video-projects', selectedProjectId, 'assembly-status'],
    queryFn: async () => {
      if (!selectedProjectId) {
        throw new Error('No project selected');
      }
      const res = await fetch(`/api/video-projects/${selectedProjectId}/assembly-status`);
      if (!res.ok) throw new Error('Failed to fetch assembly status');
      return res.json();
    },
    enabled: !!selectedProjectId,
    refetchInterval: selectedProjectId ? 5000 : false,
  });
  
  const forceAssembleMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`/api/video-projects/${projectId}/force-assemble`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to start assembly');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects'] });
      refetchStatus();
    },
  });

  useEffect(() => {
    if (params.projectId && params.projectId !== selectedProjectId) {
      setSelectedProjectId(params.projectId);
    }
  }, [params.projectId]);

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setLocation(`/video-assembly/${id}`);
  };

  const progressPercent = assemblyStatus 
    ? (assemblyStatus.readyCount / assemblyStatus.totalScenes) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/ingredients-to-video">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Film className="w-6 h-6 text-cyan-400" />
              Video Assembly Dashboard
            </h1>
            <p className="text-sm text-zinc-400">
              Monitor clip generation and assemble final videos
            </p>
          </div>
        </div>
        
        {!selectedProjectId ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium mb-3">Video Generation</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <QuickVideoGenerator />
                <ContinuousVideoGenerator />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-medium mb-3">Existing Multi-Scene Projects</h2>
              {projectsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                </div>
              ) : projects.length === 0 ? (
                <Card className="bg-zinc-900/50 border-zinc-700">
                  <CardContent className="py-12 text-center">
                    <Film className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
                    <p className="text-zinc-400">No video projects found</p>
                    <Link href="/ingredients-to-video">
                      <Button className="mt-4" variant="outline">
                        Create a Video Project
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <ProjectSelector 
                  projects={projects} 
                  selectedId={selectedProjectId}
                  onSelect={handleSelectProject}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Tabs defaultValue="status" className="space-y-4">
              <TabsList className="bg-zinc-800/50">
                <TabsTrigger value="status" data-testid="tab-assembly-status">
                  <Film className="w-4 h-4 mr-2" />
                  Assembly Status
                </TabsTrigger>
                <TabsTrigger 
                  value="editor" 
                  disabled={!assemblyStatus?.canForceAssemble}
                  data-testid="tab-video-editor"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Fine-tune Edit
                  {!assemblyStatus?.canForceAssemble && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Clips pending
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="status">
            {statusLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              </div>
            ) : assemblyStatus ? (
              <>
                <Card className="bg-zinc-900/50 border-zinc-700">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {assemblyStatus.projectTitle}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{assemblyStatus.projectStatus}</Badge>
                          <span className="text-zinc-500">•</span>
                          <span>{assemblyStatus.totalScenes} scenes</span>
                          <span className="text-zinc-500">•</span>
                          <span>~{assemblyStatus.estimatedDuration}s video</span>
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => refetchStatus()}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Refresh
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProjectId(null);
                            setLocation('/video-assembly');
                          }}
                        >
                          Change Project
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-zinc-400">Assembly Progress</span>
                          <span className="font-mono">
                            {assemblyStatus.readyCount}/{assemblyStatus.totalScenes} clips ready
                          </span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-green-400">
                            {assemblyStatus.readyCount}
                          </div>
                          <div className="text-xs text-zinc-400">Ready</div>
                        </div>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-yellow-400">
                            {assemblyStatus.pendingCount}
                          </div>
                          <div className="text-xs text-zinc-400">Pending</div>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-red-400">
                            {assemblyStatus.failedCount}
                          </div>
                          <div className="text-xs text-zinc-400">Failed</div>
                        </div>
                      </div>
                      
                      {assemblyStatus.outputUrl ? (
                        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-cyan-400" />
                              <span className="font-medium">Final Video Ready</span>
                            </div>
                            <div className="flex gap-2">
                              <a href={assemblyStatus.outputUrl} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline">
                                  <ExternalLink className="w-4 h-4 mr-1" />
                                  Preview
                                </Button>
                              </a>
                              <a href={assemblyStatus.outputUrl} download>
                                <Button size="sm">
                                  <Download className="w-4 h-4 mr-1" />
                                  Download
                                </Button>
                              </a>
                            </div>
                          </div>
                          <video 
                            src={assemblyStatus.outputUrl} 
                            controls 
                            className="w-full mt-4 rounded-lg"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                          <div>
                            <p className="font-medium">
                              {assemblyStatus.canForceAssemble 
                                ? `Ready to assemble ${assemblyStatus.readyCount} clips`
                                : 'Waiting for clips to be ready...'}
                            </p>
                            {assemblyStatus.failedCount > 0 && (
                              <p className="text-sm text-yellow-400 mt-1">
                                <AlertTriangle className="w-4 h-4 inline mr-1" />
                                {assemblyStatus.failedCount} scene(s) will be skipped
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={() => forceAssembleMutation.mutate(selectedProjectId)}
                            disabled={!assemblyStatus.canForceAssemble || forceAssembleMutation.isPending}
                            className="bg-cyan-600 hover:bg-cyan-700"
                            data-testid="button-force-assemble"
                          >
                            {forceAssembleMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Zap className="w-4 h-4 mr-2" />
                            )}
                            Force Assemble Now
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <div>
                  <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Film className="w-5 h-5" />
                    Scene Status
                  </h2>
                  <div className="space-y-3">
                    {assemblyStatus.scenes.map(scene => (
                      <SceneCard key={scene.sceneId} scene={scene} />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <Card className="bg-zinc-900/50 border-zinc-700">
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
                  <p className="text-zinc-400">Failed to load project status</p>
                  <Button 
                    className="mt-4" 
                    variant="outline"
                    onClick={() => refetchStatus()}
                  >
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}
              </TabsContent>

              <TabsContent value="editor">
                {assemblyStatus?.canForceAssemble ? (
                  <Suspense fallback={
                    <Card className="bg-zinc-900/50 border-zinc-700">
                      <CardContent className="py-12 text-center">
                        <Loader2 className="w-8 h-8 mx-auto animate-spin text-cyan-400 mb-4" />
                        <p className="text-zinc-400">Loading video editor...</p>
                      </CardContent>
                    </Card>
                  }>
                    <ShotstackStudio projectId={selectedProjectId} />
                  </Suspense>
                ) : (
                  <Card className="bg-zinc-900/50 border-zinc-700">
                    <CardContent className="py-12 text-center">
                      <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
                      <p className="text-zinc-400 mb-2">Video clips are still being generated</p>
                      <p className="text-sm text-zinc-500">
                        The editor will be available once at least one clip is ready.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
