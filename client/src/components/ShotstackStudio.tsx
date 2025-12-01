import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, Pause, Save, RefreshCw, Loader2, AlertTriangle,
  Undo, Redo, ZoomIn, ZoomOut, Maximize2, Film
} from "lucide-react";
import { Edit, Canvas, Controls, Timeline } from "@shotstack/shotstack-studio";

interface StudioTimelineResponse {
  projectId: string;
  timeline: any;
  version: number;
  lastEditedAt: string | null;
  source: 'saved_draft' | 'generated';
  sceneCount?: number;
  totalDuration?: number;
}

interface ShotstackStudioProps {
  projectId: string;
  onRenderComplete?: (outputUrl: string) => void;
}

export default function ShotstackStudio({ projectId, onRenderComplete }: ShotstackStudioProps) {
  const queryClient = useQueryClient();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  
  const [edit, setEdit] = useState<Edit | null>(null);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: timelineData, isLoading: timelineLoading, error: loadError } = useQuery<StudioTimelineResponse>({
    queryKey: ['/api/video-projects', projectId, 'studio-timeline'],
    queryFn: async () => {
      const res = await fetch(`/api/video-projects/${projectId}/studio-timeline`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load timeline');
      }
      return res.json();
    },
    enabled: !!projectId,
    refetchOnWindowFocus: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (timelineJson: any) => {
      const res = await fetch(`/api/video-projects/${projectId}/studio-timeline`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeline: timelineJson }),
      });
      if (!res.ok) throw new Error('Failed to save timeline');
      return res.json();
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects', projectId] });
    },
  });

  const renderMutation = useMutation({
    mutationFn: async (timelineJson?: any) => {
      const res = await fetch(`/api/video-projects/${projectId}/render-from-timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeline: timelineJson }),
      });
      if (!res.ok) throw new Error('Failed to start render');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects'] });
    },
  });

  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!timelineData?.timeline || !canvasContainerRef.current || !timelineContainerRef.current || isInitialized) {
      return;
    }

    const initializeStudio = async () => {
      try {
        setError(null);
        
        const template = timelineData.timeline;
        const outputSize = template.output?.size || { width: 1920, height: 1080 };
        const background = template.timeline?.background || '#000000';

        console.log('[ShotstackStudio] Initializing with output size:', outputSize);

        const newEdit = new Edit(outputSize, background);
        await newEdit.load();

        const newCanvas = new Canvas(outputSize, newEdit);
        await newCanvas.load();

        if (canvasContainerRef.current) {
          canvasContainerRef.current.innerHTML = '';
          const canvasAny = newCanvas as any;
          const canvasElement = canvasAny.getElement?.() || canvasAny.canvas || canvasAny.element;
          if (canvasElement) {
            canvasContainerRef.current.appendChild(canvasElement);
            console.log('[ShotstackStudio] Canvas mounted to DOM');
          } else if (canvasAny.mount) {
            canvasAny.mount(canvasContainerRef.current);
            console.log('[ShotstackStudio] Canvas.mount() called');
          }
        }

        await newEdit.loadEdit(template);

        const controls = new Controls(newEdit);
        await controls.load();

        const containerWidth = canvasContainerRef.current?.offsetWidth || 1280;
        const newTimeline = new Timeline(newEdit, {
          width: containerWidth,
          height: 200,
        });
        await newTimeline.load();

        if (timelineContainerRef.current) {
          timelineContainerRef.current.innerHTML = '';
          const timelineAny = newTimeline as any;
          const timelineElement = timelineAny.getElement?.() || timelineAny.timeline || timelineAny.element;
          if (timelineElement) {
            timelineContainerRef.current.appendChild(timelineElement);
            console.log('[ShotstackStudio] Timeline mounted to DOM');
          } else if (timelineAny.mount) {
            timelineAny.mount(timelineContainerRef.current);
            console.log('[ShotstackStudio] Timeline.mount() called');
          }
        }

        setEdit(newEdit);
        setCanvas(newCanvas);
        setTimeline(newTimeline);
        setTotalDuration((newEdit as any).totalDuration || 0);
        setIsInitialized(true);

        newEdit.events.on('clip:updated', () => {
          setHasUnsavedChanges(true);
        });

        console.log('[ShotstackStudio] Initialization complete');

      } catch (err: any) {
        console.error('[ShotstackStudio] Initialization error:', err);
        setError(err.message || 'Failed to initialize editor');
      }
    };

    const timer = setTimeout(initializeStudio, 100);
    
    return () => {
      clearTimeout(timer);
    };
  }, [timelineData, isInitialized]);

  useEffect(() => {
    return () => {
      if (canvas) {
        canvas.dispose();
        setIsInitialized(false);
      }
    };
  }, [canvas]);

  useEffect(() => {
    if (!edit) return;
    
    const interval = setInterval(() => {
      if (edit) {
        setCurrentTime((edit as any).currentTime || 0);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [edit]);

  const handlePlay = () => {
    if (!edit) return;
    if (isPlaying) {
      edit.pause();
    } else {
      edit.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    if (!edit) return;
    edit.stop();
    setIsPlaying(false);
  };

  const handleUndo = () => {
    if (edit) {
      edit.undo();
      setHasUnsavedChanges(true);
    }
  };

  const handleRedo = () => {
    if (edit) {
      edit.redo();
      setHasUnsavedChanges(true);
    }
  };

  const handleZoomIn = () => {
    if (canvas) {
      const newZoom = Math.min(zoomLevel * 1.2, 4.0);
      canvas.setZoom(newZoom);
      setZoomLevel(newZoom);
    }
  };

  const handleZoomOut = () => {
    if (canvas) {
      const newZoom = Math.max(zoomLevel * 0.8, 0.25);
      canvas.setZoom(newZoom);
      setZoomLevel(newZoom);
    }
  };

  const handleFitToView = () => {
    if (canvas) {
      canvas.zoomToFit();
      canvas.centerEdit();
      setZoomLevel(1.0);
    }
  };

  const handleSave = async () => {
    if (!edit) return;
    const timelineJson = edit.getEdit();
    await saveMutation.mutateAsync(timelineJson);
  };

  const handleRender = async () => {
    if (!edit) return;
    const timelineJson = edit.getEdit();
    await saveMutation.mutateAsync(timelineJson);
    await renderMutation.mutateAsync(timelineJson);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (timelineLoading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-700">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-cyan-400 mb-4" />
          <p className="text-zinc-400">Loading video editor...</p>
        </CardContent>
      </Card>
    );
  }

  if (loadError || error) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-700">
        <CardContent className="py-12 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
          <p className="text-zinc-400">{(loadError as Error)?.message || error}</p>
          <Button 
            className="mt-4" 
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/video-projects', projectId, 'studio-timeline'] })}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-zinc-900/50 border-zinc-700">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Film className="w-5 h-5 text-cyan-400" />
                Video Editor
              </CardTitle>
              {timelineData && (
                <Badge variant="outline" className="text-xs">
                  v{timelineData.version} • {timelineData.source === 'saved_draft' ? 'Draft' : 'Auto-generated'}
                </Badge>
              )}
              {hasUnsavedChanges && (
                <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-400">
                  Unsaved changes
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                disabled={saveMutation.isPending || !hasUnsavedChanges}
                data-testid="button-save-timeline"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="ml-2">Save</span>
              </Button>
              
              <Button
                size="sm"
                onClick={handleRender}
                disabled={renderMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="button-render-video"
              >
                {renderMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Film className="w-4 h-4 mr-2" />
                )}
                Render Video
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-2">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={handleUndo} data-testid="button-undo">
                <Undo className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleRedo} data-testid="button-redo">
                <Redo className="w-4 h-4" />
              </Button>
              
              <div className="w-px h-6 bg-zinc-600 mx-2" />
              
              <Button 
                size="sm" 
                variant={isPlaying ? "secondary" : "ghost"} 
                onClick={handlePlay}
                data-testid="button-play-pause"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              
              <span className="text-sm text-zinc-400 font-mono">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={handleZoomOut} data-testid="button-zoom-out">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleZoomIn} data-testid="button-zoom-in">
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleFitToView} data-testid="button-fit-view">
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div 
            ref={canvasContainerRef}
            className="relative bg-black rounded-lg overflow-hidden"
            style={{ aspectRatio: '16/9', minHeight: '400px' }}
            data-shotstack-studio
            data-testid="studio-canvas"
          >
            {!edit && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              </div>
            )}
          </div>

          <div 
            ref={timelineContainerRef}
            className="bg-zinc-800/50 rounded-lg overflow-hidden"
            style={{ minHeight: '200px' }}
            data-shotstack-timeline
            data-testid="studio-timeline"
          />
        </CardContent>
      </Card>

      {renderMutation.isSuccess && (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="py-4">
            <p className="text-green-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Render started! Your video is being processed...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
