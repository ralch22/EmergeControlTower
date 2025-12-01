import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { 
  Settings,
  Video, 
  Image,
  Mic,
  Brain,
  Type,
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Zap,
  RefreshCw,
  ArrowLeft,
  Loader2,
  Activity,
  Clock,
  TrendingUp,
  Shield,
  ExternalLink,
  Sparkles,
  DollarSign,
  AlertTriangle,
  BarChart3,
  Layers,
  ChevronRight
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

type ProviderHealth = {
  providerName: string;
  serviceType: string;
  isHealthy: boolean;
  healthScore: number;
  successRate: number;
  avgLatencyMs: number;
  rateLimitActive: boolean;
  priority: number;
  isFreeProvider: boolean;
  totalRequests?: number;
  lastError?: string;
};

const categoryIcons: Record<string, React.ReactNode> = {
  video: <Video className="w-5 h-5" />,
  image: <Image className="w-5 h-5" />,
  voiceover: <Mic className="w-5 h-5" />,
  audio: <Mic className="w-5 h-5" />,
  llm: <Brain className="w-5 h-5" />,
  text: <Type className="w-5 h-5" />,
};

const categoryLabels: Record<string, string> = {
  video: "Video Generation",
  image: "Image Generation",
  voiceover: "Voice & Audio",
  audio: "Voice & Audio",
  llm: "AI / LLM",
  text: "Text Generation",
};

const categoryDescriptions: Record<string, string> = {
  video: "Generate AI video clips from images and prompts",
  image: "Create images for video scene backgrounds",
  voiceover: "Text-to-speech for voiceovers",
  audio: "Text-to-speech for voiceovers",
  llm: "Content generation and orchestration",
  text: "Script writing, blog posts, and content creation",
};

const statusColors: Record<string, string> = {
  working: "text-green-400",
  active: "text-green-400",
  error: "text-red-400",
  rate_limited: "text-yellow-400",
  unknown: "text-zinc-500",
  inactive: "text-zinc-500",
};

const statusBgColors: Record<string, string> = {
  working: "bg-green-500/10 border-green-500/30",
  active: "bg-green-500/10 border-green-500/30",
  error: "bg-red-500/10 border-red-500/30",
  rate_limited: "bg-yellow-500/10 border-yellow-500/30",
  unknown: "bg-zinc-500/10 border-zinc-500/30",
  inactive: "bg-zinc-500/10 border-zinc-500/30",
};

const providerDocs: Record<string, string> = {
  anthropic: "https://console.anthropic.com/",
  gemini: "https://aistudio.google.com/",
  gemini_text: "https://aistudio.google.com/",
  gemini_image: "https://aistudio.google.com/",
  openrouter: "https://openrouter.ai/keys",
  openrouter_deepseek_r1: "https://openrouter.ai/models/deepseek/deepseek-r1",
  openrouter_llama4_maverick: "https://openrouter.ai/models/meta-llama/llama-4-maverick",
  openrouter_mistral_small: "https://openrouter.ai/models/mistralai/mistral-small-3.1",
  openrouter_qwen3: "https://openrouter.ai/models/qwen/qwen-3-235b",
  openrouter_deepseek_v3: "https://openrouter.ai/models/deepseek/deepseek-v3",
  runway: "https://dev.runwayml.com/",
  elevenlabs: "https://elevenlabs.io/app/settings/api-keys",
  openai_tts: "https://platform.openai.com/api-keys",
  fal_ai: "https://fal.ai/dashboard/keys",
  dashscope: "https://dashscope.console.aliyun.com/",
  adobe_firefly: "https://developer.adobe.com/firefly-api/",
  veo31: "https://aistudio.google.com/",
  veo2: "https://aistudio.google.com/",
  shotstack: "https://dashboard.shotstack.io/",
};

const providerDescriptions: Record<string, string> = {
  anthropic: "Claude Sonnet 4.5 - Premium reasoning",
  openrouter_deepseek_r1: "DeepSeek R1 - Free reasoning model",
  openrouter_llama4_maverick: "Llama 4 Maverick - Free from Meta",
  openrouter_mistral_small: "Mistral Small 3.1 - Free & fast",
  openrouter_qwen3: "Qwen 3 235B - Advanced multilingual",
  openrouter_deepseek_v3: "DeepSeek V3 - Balanced performance",
  gemini_text: "Gemini 1.5 Flash - Free from Google",
  veo31: "Google Veo 3.1 - Latest video model",
  veo2: "Google Veo 2.0 - Stable video generation",
  runway: "Runway Gen-4 Turbo - High quality video",
  elevenlabs: "ElevenLabs - Natural voice synthesis",
  openai_tts: "OpenAI TTS - Reliable fallback",
  gemini_image: "Gemini 2.0 Flash - Free image gen",
  fal_ai: "Fal AI Flux Pro - Fast image generation",
  dashscope: "Alibaba Dashscope - Wan 2.5 images",
  adobe_firefly: "Adobe Firefly - Enterprise quality",
  shotstack: "Shotstack - Video assembly & editing",
};

function HealthScoreBadge({ score }: { score: number }) {
  const color = score >= 90 ? "text-green-400" : score >= 70 ? "text-yellow-400" : "text-red-400";
  const bg = score >= 90 ? "bg-green-500/10" : score >= 70 ? "bg-yellow-500/10" : "bg-red-500/10";
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded ${bg} ${color}`}>
      {score.toFixed(0)}%
    </span>
  );
}

function LatencyBadge({ ms }: { ms: number }) {
  if (ms === 0) return null;
  const color = ms < 2000 ? "text-green-400" : ms < 5000 ? "text-yellow-400" : "text-red-400";
  return (
    <span className={`text-xs ${color} flex items-center gap-1`}>
      <Clock className="w-3 h-3" />
      {ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}
    </span>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testingProvider, setTestingProvider] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("providers");

  const { data: providers = [], isLoading: providersLoading } = useQuery<AiProvider[]>({
    queryKey: ["/api/providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers");
      if (!res.ok) throw new Error("Failed to fetch providers");
      return res.json();
    },
  });

  const { data: healthData, isLoading: healthLoading } = useQuery<{ providers: ProviderHealth[] }>({
    queryKey: ["/api/providers/health"],
    queryFn: async () => {
      const res = await fetch("/api/providers/health");
      if (!res.ok) throw new Error("Failed to fetch health data");
      return res.json();
    },
    refetchInterval: 30000,
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
      queryClient.invalidateQueries({ queryKey: ["/api/providers/health"] });
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

  const healthProviders = healthData?.providers ?? [];
  const healthMap = new Map<string, ProviderHealth>();
  healthProviders.forEach(p => healthMap.set(p.providerName, p));

  const groupedProviders = providers.reduce((acc, provider) => {
    if (!acc[provider.category]) {
      acc[provider.category] = [];
    }
    acc[provider.category].push(provider);
    return acc;
  }, {} as Record<string, AiProvider[]>);

  Object.keys(groupedProviders).forEach(category => {
    groupedProviders[category].sort((a, b) => a.priority - b.priority);
  });

  const categoryOrder = ['text', 'video', 'image', 'voiceover', 'llm'];

  const totalProviders = providers.length;
  const enabledProviders = providers.filter(p => p.isEnabled).length;
  const healthyProviders = healthProviders.filter(p => p.isHealthy).length;
  const freeProviders = healthProviders.filter(p => p.isFreeProvider).length;

  const isLoading = providersLoading || healthLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-zinc-400">Loading provider settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100" data-testid="back-button">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Settings className="w-7 h-7 text-cyan-400" />
                AI Provider Settings
              </h1>
              <p className="text-zinc-400 mt-1">
                Configure providers, view health metrics, and manage fallback chains
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/providers/health"] })}
            data-testid="refresh-health-button"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Status
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg">
                  <Layers className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalProviders}</p>
                  <p className="text-xs text-zinc-500">Total Providers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{enabledProviders}</p>
                  <p className="text-xs text-zinc-500">Enabled</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Activity className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{healthyProviders}</p>
                  <p className="text-xs text-zinc-500">Healthy</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{freeProviders}</p>
                  <p className="text-xs text-zinc-500">Free Tier</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="providers" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Layers className="w-4 h-4 mr-2" />
              Providers
            </TabsTrigger>
            <TabsTrigger value="health" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Activity className="w-4 h-4 mr-2" />
              Health Monitor
            </TabsTrigger>
            <TabsTrigger value="fallbacks" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Zap className="w-4 h-4 mr-2" />
              Fallback Chains
            </TabsTrigger>
          </TabsList>

          {/* Providers Tab */}
          <TabsContent value="providers" className="space-y-6">
            {/* Fallback Info Card */}
            <Card className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-500/20">
              <CardContent className="p-4 flex items-start gap-4">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <Zap className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-cyan-400">ML-Powered Self-Healing System</h3>
                  <p className="text-sm text-zinc-400 mt-1">
                    The system automatically routes requests to healthy providers, learns from failures,
                    and prioritizes free-tier options. Enable multiple providers per category for maximum reliability.
                  </p>
                </div>
                <Link href="/provider-health">
                  <Button variant="ghost" size="sm" className="text-cyan-400 hover:bg-cyan-500/10" data-testid="view-health-dashboard">
                    View Dashboard
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Provider Categories */}
            <div className="space-y-6">
              {categoryOrder.map(category => {
                const categoryProviders = groupedProviders[category] || [];
                if (categoryProviders.length === 0) return null;

                const enabledCount = categoryProviders.filter(p => p.isEnabled).length;
                const categoryHealth = categoryProviders.map(p => healthMap.get(p.name)).filter(Boolean);
                const avgHealth = categoryHealth.length > 0 
                  ? categoryHealth.reduce((sum, h) => sum + (h?.healthScore || 0), 0) / categoryHealth.length
                  : 0;

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
                        <div className="flex items-center gap-3">
                          {avgHealth > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-500">Avg Health:</span>
                              <HealthScoreBadge score={avgHealth} />
                            </div>
                          )}
                          <Badge variant="outline" className="bg-zinc-800 border-zinc-700">
                            {enabledCount} of {categoryProviders.length} enabled
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {categoryProviders.map((provider, index) => {
                          const health = healthMap.get(provider.name);
                          const isFree = health?.isFreeProvider;
                          const isRateLimited = health?.rateLimitActive;
                          
                          return (
                            <div
                              key={provider.id}
                              data-testid={`provider-row-${provider.name}`}
                              className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                                provider.isEnabled 
                                  ? 'bg-zinc-800/80 border border-zinc-700' 
                                  : 'bg-zinc-900/50 border border-zinc-800/50 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <div className="flex items-center gap-2 min-w-[36px]">
                                  <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                                    #{index + 1}
                                  </span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{provider.displayName}</span>
                                    {isFree && (
                                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                                        <DollarSign className="w-3 h-3 mr-1" />
                                        FREE
                                      </Badge>
                                    )}
                                    {isRateLimited && (
                                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        Rate Limited
                                      </Badge>
                                    )}
                                    {provider.apiKeyConfigured ? (
                                      <span className="text-xs text-green-400 flex items-center gap-1">
                                        <Shield className="w-3 h-3" />
                                        Configured
                                      </span>
                                    ) : (
                                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        No API key
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                    {providerDescriptions[provider.name] && (
                                      <span>{providerDescriptions[provider.name]}</span>
                                    )}
                                  </div>
                                  {health && (
                                    <div className="flex items-center gap-4 mt-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-zinc-500">Health:</span>
                                        <HealthScoreBadge score={health.healthScore} />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-zinc-500">Success:</span>
                                        <span className={`text-xs ${health.successRate >= 90 ? 'text-green-400' : health.successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                                          {health.successRate.toFixed(0)}%
                                        </span>
                                      </div>
                                      <LatencyBadge ms={health.avgLatencyMs} />
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {providerDocs[provider.name] && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    asChild
                                    className="text-zinc-500 hover:text-zinc-100"
                                  >
                                    <a href={providerDocs[provider.name]} target="_blank" rel="noopener noreferrer" data-testid={`docs-${provider.name}`}>
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                  </Button>
                                )}
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
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Health Monitor Tab */}
          <TabsContent value="health" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {['text', 'video', 'image', 'audio'].map(serviceType => {
                const typeProviders = healthProviders.filter(p => p.serviceType === serviceType);
                if (typeProviders.length === 0) return null;

                return (
                  <Card key={serviceType} className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        {categoryIcons[serviceType]}
                        <CardTitle className="text-lg capitalize">{serviceType} Providers</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {typeProviders.sort((a, b) => b.healthScore - a.healthScore).map(provider => (
                          <div key={provider.providerName} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{provider.providerName}</span>
                                {provider.isFreeProvider && (
                                  <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
                                    Free
                                  </Badge>
                                )}
                                {provider.rateLimitActive && (
                                  <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">
                                    Rate Limited
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${provider.isHealthy ? 'bg-green-400' : 'bg-red-400'}`} />
                                <span className="text-sm font-mono">{provider.healthScore.toFixed(0)}%</span>
                              </div>
                            </div>
                            <Progress 
                              value={provider.healthScore} 
                              className="h-2 bg-zinc-800"
                            />
                            <div className="flex items-center justify-between text-xs text-zinc-500">
                              <span>Success: {provider.successRate.toFixed(0)}%</span>
                              {provider.avgLatencyMs > 0 && (
                                <span>Latency: {provider.avgLatencyMs < 1000 ? `${provider.avgLatencyMs}ms` : `${(provider.avgLatencyMs / 1000).toFixed(1)}s`}</span>
                              )}
                              <span>Priority: {provider.priority}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Fallback Chains Tab */}
          <TabsContent value="fallbacks" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Text Generation Chain */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Type className="w-5 h-5 text-cyan-400" />
                    <CardTitle>Text Generation Chain</CardTitle>
                  </div>
                  <CardDescription>Script writing, content creation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { name: 'Claude (Anthropic)', priority: 1, free: false, status: 'primary' },
                      { name: 'DeepSeek R1', priority: 2, free: true, status: 'fallback' },
                      { name: 'Llama 4 Maverick', priority: 3, free: true, status: 'fallback' },
                      { name: 'Gemini 1.5 Flash', priority: 4, free: true, status: 'fallback' },
                      { name: 'Mistral Small 3.1', priority: 5, free: true, status: 'fallback' },
                    ].map((chain, i) => (
                      <div key={chain.name} className="flex items-center gap-3 p-2 rounded bg-zinc-800/50">
                        <span className="text-xs font-mono text-cyan-400 w-6">#{chain.priority}</span>
                        <ChevronRight className="w-4 h-4 text-zinc-600" />
                        <span className="flex-1 text-sm">{chain.name}</span>
                        {chain.free && (
                          <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">FREE</Badge>
                        )}
                        {chain.status === 'primary' && (
                          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">Primary</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Video Generation Chain */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-cyan-400" />
                    <CardTitle>Video Generation Chain</CardTitle>
                  </div>
                  <CardDescription>AI video clip generation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { name: 'Google Veo 3.1', priority: 1, free: true, status: 'primary' },
                      { name: 'Google Veo 2.0', priority: 2, free: true, status: 'fallback' },
                      { name: 'Runway Gen-4', priority: 3, free: false, status: 'fallback' },
                    ].map((chain) => (
                      <div key={chain.name} className="flex items-center gap-3 p-2 rounded bg-zinc-800/50">
                        <span className="text-xs font-mono text-cyan-400 w-6">#{chain.priority}</span>
                        <ChevronRight className="w-4 h-4 text-zinc-600" />
                        <span className="flex-1 text-sm">{chain.name}</span>
                        {chain.free && (
                          <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">FREE</Badge>
                        )}
                        {chain.status === 'primary' && (
                          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">Primary</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Image Generation Chain */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Image className="w-5 h-5 text-cyan-400" />
                    <CardTitle>Image Generation Chain</CardTitle>
                  </div>
                  <CardDescription>Scene backgrounds, thumbnails</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { name: 'Gemini 2.0 Flash', priority: 1, free: true, status: 'primary' },
                      { name: 'Fal AI Flux Pro', priority: 2, free: false, status: 'fallback' },
                      { name: 'Alibaba Dashscope', priority: 3, free: false, status: 'fallback' },
                      { name: 'Adobe Firefly', priority: 4, free: false, status: 'fallback' },
                    ].map((chain) => (
                      <div key={chain.name} className="flex items-center gap-3 p-2 rounded bg-zinc-800/50">
                        <span className="text-xs font-mono text-cyan-400 w-6">#{chain.priority}</span>
                        <ChevronRight className="w-4 h-4 text-zinc-600" />
                        <span className="flex-1 text-sm">{chain.name}</span>
                        {chain.free && (
                          <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">FREE</Badge>
                        )}
                        {chain.status === 'primary' && (
                          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">Primary</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Voice Generation Chain */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Mic className="w-5 h-5 text-cyan-400" />
                    <CardTitle>Voice Generation Chain</CardTitle>
                  </div>
                  <CardDescription>Text-to-speech voiceovers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { name: 'ElevenLabs', priority: 1, free: false, status: 'primary' },
                      { name: 'OpenAI TTS', priority: 2, free: false, status: 'fallback' },
                    ].map((chain) => (
                      <div key={chain.name} className="flex items-center gap-3 p-2 rounded bg-zinc-800/50">
                        <span className="text-xs font-mono text-cyan-400 w-6">#{chain.priority}</span>
                        <ChevronRight className="w-4 h-4 text-zinc-600" />
                        <span className="flex-1 text-sm">{chain.name}</span>
                        {chain.free && (
                          <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">FREE</Badge>
                        )}
                        {chain.status === 'primary' && (
                          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">Primary</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Quick Setup Guide */}
        <Card className="bg-zinc-900/50 border-zinc-800 mt-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              Quick Setup Guide
            </CardTitle>
            <CardDescription>Add these API keys to your Replit Secrets to enable providers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <Type className="w-4 h-4 text-cyan-400" />
                  Text: OpenRouter
                </h4>
                <p className="text-sm text-zinc-400 mb-2">
                  Access 100+ AI models including free options
                </p>
                <code className="text-xs bg-zinc-700 px-2 py-1 rounded block">OPENROUTER_API_KEY</code>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <Video className="w-4 h-4 text-cyan-400" />
                  Video: Runway
                </h4>
                <p className="text-sm text-zinc-400 mb-2">
                  High-quality video generation
                </p>
                <code className="text-xs bg-zinc-700 px-2 py-1 rounded block">RUNWAY_API_KEY</code>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <Video className="w-4 h-4 text-cyan-400" />
                  Video: Google Veo
                </h4>
                <p className="text-sm text-zinc-400 mb-2">
                  Free video generation via Gemini API
                </p>
                <code className="text-xs bg-zinc-700 px-2 py-1 rounded block">GEMINI_API_KEY</code>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <Image className="w-4 h-4 text-cyan-400" />
                  Image: Fal AI
                </h4>
                <p className="text-sm text-zinc-400 mb-2">
                  Fast Flux Pro image generation
                </p>
                <code className="text-xs bg-zinc-700 px-2 py-1 rounded block">FAL_API_KEY</code>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <Mic className="w-4 h-4 text-cyan-400" />
                  Voice: ElevenLabs
                </h4>
                <p className="text-sm text-zinc-400 mb-2">
                  Natural voice synthesis
                </p>
                <code className="text-xs bg-zinc-700 px-2 py-1 rounded block">ELEVENLABS_API_KEY</code>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  Assembly: Shotstack
                </h4>
                <p className="text-sm text-zinc-400 mb-2">
                  Video assembly and editing
                </p>
                <code className="text-xs bg-zinc-700 px-2 py-1 rounded block">SHOTSTACK_API_KEY</code>
              </div>
            </div>
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span><strong>Claude (Anthropic)</strong> is automatically configured via Replit AI Integrations</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
