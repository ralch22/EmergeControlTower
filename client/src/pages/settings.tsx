import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { 
  Settings,
  Video, 
  Image,
  Mic,
  Brain,
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Zap,
  GripVertical,
  RefreshCw,
  ArrowLeft,
  Loader2
} from "lucide-react";

type AiProvider = {
  id: number;
  category: string;
  name: string;
  displayName: string;
  isEnabled: boolean;
  priority: number;
  apiKeyConfigured: boolean;
  lastStatus: string;
  lastChecked: string | null;
  config: string | null;
};

const categoryIcons: Record<string, React.ReactNode> = {
  video: <Video className="w-5 h-5" />,
  image: <Image className="w-5 h-5" />,
  voiceover: <Mic className="w-5 h-5" />,
  llm: <Brain className="w-5 h-5" />,
};

const categoryLabels: Record<string, string> = {
  video: "Video Generation",
  image: "Image Generation",
  voiceover: "Voice & Audio",
  llm: "AI / LLM",
};

const categoryDescriptions: Record<string, string> = {
  video: "Generate AI video clips from images and prompts",
  image: "Create images for video scene backgrounds",
  voiceover: "Text-to-speech for voiceovers",
  llm: "Content generation and orchestration",
};

const statusColors: Record<string, string> = {
  working: "text-green-400",
  error: "text-red-400",
  rate_limited: "text-yellow-400",
  unknown: "text-zinc-500",
};

const statusIcons: Record<string, React.ReactNode> = {
  working: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  error: <XCircle className="w-4 h-4 text-red-400" />,
  rate_limited: <AlertCircle className="w-4 h-4 text-yellow-400" />,
  unknown: <AlertCircle className="w-4 h-4 text-zinc-500" />,
};

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testingProvider, setTestingProvider] = useState<number | null>(null);

  const { data: providers = [], isLoading, error } = useQuery<AiProvider[]>({
    queryKey: ["/api/providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers");
      if (!res.ok) throw new Error("Failed to fetch providers");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: number; isEnabled: boolean }) => {
      const res = await fetch(`/api/providers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      setTestingProvider(id);
      const res = await fetch(`/api/providers/${id}/test`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      setTestingProvider(null);
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      toast({ 
        title: data.status === 'working' ? "Provider Working" : "Provider Issue",
        description: data.message,
        variant: data.status === 'working' ? 'default' : 'destructive'
      });
    },
    onError: (error: Error) => {
      setTestingProvider(null);
      toast({ title: "Test Failed", description: error.message, variant: "destructive" });
    },
  });

  const groupedProviders = providers.reduce((acc, provider) => {
    if (!acc[provider.category]) {
      acc[provider.category] = [];
    }
    acc[provider.category].push(provider);
    return acc;
  }, {} as Record<string, AiProvider[]>);

  // Sort providers within each category by priority
  Object.keys(groupedProviders).forEach(category => {
    groupedProviders[category].sort((a, b) => a.priority - b.priority);
  });

  const categoryOrder = ['video', 'image', 'voiceover', 'llm'];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Settings className="w-7 h-7 text-cyan-400" />
              AI Provider Settings
            </h1>
            <p className="text-zinc-400 mt-1">
              Configure AI providers and set up automatic fallbacks for reliability
            </p>
          </div>
        </div>

        {/* Fallback Info Card */}
        <Card className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-500/20 mb-8">
          <CardContent className="p-4 flex items-start gap-4">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Zap className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-cyan-400">Automatic Fallback System</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Enable multiple providers per category. If the primary provider fails or hits rate limits,
                the system automatically tries the next enabled provider in priority order.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Provider Categories */}
        <div className="space-y-6">
          {categoryOrder.map(category => {
            const categoryProviders = groupedProviders[category] || [];
            if (categoryProviders.length === 0) return null;

            const enabledCount = categoryProviders.filter(p => p.isEnabled).length;

            return (
              <Card key={category} className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-800 rounded-lg text-cyan-400">
                        {categoryIcons[category]}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{categoryLabels[category]}</CardTitle>
                        <CardDescription className="text-zinc-500">
                          {categoryDescriptions[category]}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-zinc-800 border-zinc-700">
                      {enabledCount} of {categoryProviders.length} enabled
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {categoryProviders.map((provider, index) => (
                      <div
                        key={provider.id}
                        data-testid={`provider-row-${provider.name}`}
                        className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                          provider.isEnabled 
                            ? 'bg-zinc-800/80 border border-zinc-700' 
                            : 'bg-zinc-900/50 border border-zinc-800/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-zinc-600 cursor-grab">
                            <GripVertical className="w-5 h-5" />
                          </div>
                          <div className="flex items-center gap-2 min-w-[24px]">
                            <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                              #{index + 1}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{provider.displayName}</span>
                              {provider.apiKeyConfigured ? (
                                <span className="text-xs text-green-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Key configured
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-500 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  No API key
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {provider.lastStatus && provider.lastStatus !== 'unknown' && (
                                <span className={`text-xs flex items-center gap-1 ${statusColors[provider.lastStatus]}`}>
                                  {statusIcons[provider.lastStatus]}
                                  {provider.lastStatus}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => testMutation.mutate(provider.id)}
                            disabled={testingProvider === provider.id}
                            className="text-zinc-400 hover:text-zinc-100"
                            data-testid={`test-provider-${provider.name}`}
                          >
                            {testingProvider === provider.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            <span className="ml-2">Test</span>
                          </Button>
                          <Switch
                            checked={provider.isEnabled}
                            onCheckedChange={(checked) => 
                              updateMutation.mutate({ id: provider.id, isEnabled: checked })
                            }
                            data-testid={`toggle-provider-${provider.name}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Setup Guide */}
        <Card className="bg-zinc-900/50 border-zinc-800 mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Quick Setup Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <Video className="w-4 h-4 text-cyan-400" />
                  Video: Runway
                </h4>
                <p className="text-sm text-zinc-400">
                  Add <code className="bg-zinc-700 px-1 rounded">RUNWAY_API_KEY</code> to your secrets
                </p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <Image className="w-4 h-4 text-cyan-400" />
                  Image: Gemini
                </h4>
                <p className="text-sm text-zinc-400">
                  Add <code className="bg-zinc-700 px-1 rounded">GEMINI_API_KEY</code> to your secrets
                </p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <Mic className="w-4 h-4 text-cyan-400" />
                  Voice: ElevenLabs
                </h4>
                <p className="text-sm text-zinc-400">
                  Add <code className="bg-zinc-700 px-1 rounded">ELEVENLABS_API_KEY</code> to your secrets
                </p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-cyan-400" />
                  LLM: Claude
                </h4>
                <p className="text-sm text-zinc-400">
                  Automatically configured via Replit AI Integrations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
