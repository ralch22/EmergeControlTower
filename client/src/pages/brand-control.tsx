import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Palette, 
  Type, 
  Image, 
  Video, 
  FileText, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Plus,
  Upload,
  Download,
  Sparkles,
  Wand2,
  Link,
  Globe
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: number;
  name: string;
  industry: string;
  brandVoice: string;
  targetAudience: string;
  keywords: string;
  contentGoals: string;
  brandProfile?: any;
  primaryLogoUrl?: string;
  websiteUrl?: string;
}

interface GenerationResult {
  success: boolean;
  assetType: string;
  assets?: Array<{
    id: string;
    url?: string;
    localPath?: string;
    base64?: string;
    mimeType: string;
    metadata?: any;
  }>;
  error?: string;
  processingTime?: number;
}

interface BrandAssetFile {
  id: number;
  clientId: number;
  category: string;
  subcategory?: string;
  fileName: string;
  originalName: string;
  filePath: string;
  fileType: string;
  mimeType?: string;
  fileSize: number;
  purpose?: string;
  metadata?: Record<string, unknown>;
  uploadedAt: string;
}

export default function BrandControlPage() {
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [generatingAssets, setGeneratingAssets] = useState<Record<string, boolean>>({});
  const [generatedResults, setGeneratedResults] = useState<Record<string, GenerationResult>>({});
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [guidelinesUrl, setGuidelinesUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: selectedClient, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients", selectedClientId],
    enabled: !!selectedClientId,
  });

  const { data: brandAssetFiles = [], isLoading: assetsLoading, refetch: refetchAssets } = useQuery<BrandAssetFile[]>({
    queryKey: ["/api/brand-asset-files", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await fetch(`/api/brand-asset-files/${selectedClientId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedClientId,
  });

  const getClientLogoUrl = (): string | null => {
    // First priority: Check brand asset files for actual uploaded logos
    const logoFile = brandAssetFiles.find(
      f => f.subcategory === 'logos' || f.category === 'logos' || f.purpose?.includes('logo')
    );
    if (logoFile) {
      return `/api/brand-asset-files/download/${logoFile.id}`;
    }
    
    // Second priority: Use primaryLogoUrl if it's a valid internal path
    if (selectedClient?.primaryLogoUrl) {
      const url = selectedClient.primaryLogoUrl;
      // Only use if it's our internal download path (not placeholder/external CDN)
      if (url.startsWith('/api/brand-asset-files/download/')) {
        return url;
      }
      // Block known placeholder patterns
      const isPlaceholder = 
        url.includes('placeholder') ||
        url.includes('via.placeholder') ||
        url.includes('placehold.co') ||
        url.includes('dummyimage') ||
        url.startsWith('data:image/svg') ||
        url.length < 20; // Too short to be a real URL
      if (!isPlaceholder) {
        return url;
      }
    }
    
    return null;
  };

  const clientLogoUrl = getClientLogoUrl();

  const generateAssetMutation = useMutation({
    mutationFn: async ({ clientId, assetType, options }: { clientId: number; assetType: string; options?: any }) => {
      const response = await fetch(`/api/clients/${clientId}/generate/${assetType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options || {}),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Generation failed");
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      setGeneratedResults(prev => ({
        ...prev,
        [variables.assetType]: data,
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/brand-asset-files", selectedClientId] });
      toast({
        title: "Asset Generated",
        description: `Successfully generated ${variables.assetType}`,
      });
    },
    onError: (error: Error, variables) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: (_, __, variables) => {
      setGeneratingAssets(prev => ({ ...prev, [variables.assetType]: false }));
    },
  });

  const handleGenerateAsset = async (assetType: string, options?: any) => {
    if (!selectedClientId) return;
    setGeneratingAssets(prev => ({ ...prev, [assetType]: true }));
    generateAssetMutation.mutate({ clientId: selectedClientId, assetType, options });
  };

  const generateCompletePackage = async () => {
    if (!selectedClientId) return;
    setGeneratingAssets(prev => ({ ...prev, "complete-package": true }));
    generateAssetMutation.mutate({ 
      clientId: selectedClientId, 
      assetType: "complete-package",
      options: { options: {} }
    });
  };

  const handleImportGuidelines = async () => {
    if (!selectedClientId || (!guidelinesUrl && !websiteUrl)) return;
    
    setIsImporting(true);
    try {
      const response = await fetch(`/api/clients/${selectedClientId}/import-guidelines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidelinesUrl, websiteUrl }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }
      
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId] });
      
      toast({
        title: "Guidelines Imported",
        description: "Brand profile has been generated from external sources",
      });
      
      setImportDialogOpen(false);
      setGuidelinesUrl("");
      setWebsiteUrl("");
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const assetTypes = [
    { id: "mood-board", label: "Mood Board", icon: Image, description: "1920x1080 brand collage" },
    { id: "icons", label: "Icon Set", icon: Sparkles, description: "10 branded icons" },
    { id: "infographic", label: "Infographic", icon: FileText, description: "Tokenomics diagram" },
    { id: "logo-variant", label: "Logo Variants", icon: Palette, description: "Mono/inverted versions" },
    { id: "social-image", label: "Social Images", icon: Image, description: "Platform-specific" },
    { id: "promo-script", label: "Promo Script", icon: Video, description: "30-second video script" },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="brand-control-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Brand Control Center</h1>
          <p className="text-muted-foreground">Manage client brand profiles and generate brand assets</p>
        </div>
        <Button variant="outline" data-testid="button-add-client">
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Clients</CardTitle>
            <CardDescription>Select a client to manage</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {clientsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : clients?.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No clients yet</p>
              ) : (
                <div className="space-y-2">
                  {clients?.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClientId(client.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedClientId === client.id
                          ? "bg-primary/10 border border-primary"
                          : "hover:bg-muted border border-transparent"
                      }`}
                      data-testid={`client-item-${client.id}`}
                    >
                      <div className="font-medium">{client.name}</div>
                      <div className="text-sm text-muted-foreground">{client.industry}</div>
                      {client.brandProfile && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          Profile Complete
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {selectedClient ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedClient.name}</CardTitle>
                      <CardDescription>{selectedClient.industry}</CardDescription>
                    </div>
                    {clientLogoUrl && (
                      <img 
                        src={clientLogoUrl} 
                        alt="Logo" 
                        className="w-16 h-16 object-contain rounded border bg-white/5"
                        data-testid="client-logo"
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="profile">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
                      <TabsTrigger value="visual" data-testid="tab-visual">Visual</TabsTrigger>
                      <TabsTrigger value="generate" data-testid="tab-generate">Generate</TabsTrigger>
                      <TabsTrigger value="assets" data-testid="tab-assets">Assets</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="space-y-4 mt-4">
                      {selectedClient.brandProfile ? (
                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <Label>Brand Name</Label>
                              <div className="mt-1 p-2 bg-muted rounded text-sm">
                                {selectedClient.brandProfile.textual?.brandName?.primary}
                              </div>
                            </div>
                            <div>
                              <Label>Token Symbol</Label>
                              <div className="mt-1 p-2 bg-muted rounded text-sm">
                                {selectedClient.brandProfile.textual?.brandName?.token || "N/A"}
                              </div>
                            </div>
                          </div>

                          <div>
                            <Label>Tagline</Label>
                            <div className="mt-1 p-2 bg-muted rounded text-sm">
                              {selectedClient.brandProfile.textual?.tagline?.primary}
                            </div>
                          </div>

                          <div>
                            <Label>Brand Story</Label>
                            <div className="mt-1 p-2 bg-muted rounded text-sm whitespace-pre-wrap">
                              {selectedClient.brandProfile.textual?.brandStory?.short}
                            </div>
                          </div>

                          <div>
                            <Label>Values</Label>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {selectedClient.brandProfile.textual?.values?.map((v: any, i: number) => (
                                <Badge key={i} variant="secondary">{v.name}</Badge>
                              ))}
                            </div>
                          </div>

                          <div>
                            <Label>Keywords</Label>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {selectedClient.brandProfile.textual?.keywords?.map((kw: string, i: number) => (
                                <Badge key={i} variant="outline">{kw}</Badge>
                              ))}
                            </div>
                          </div>

                          <div>
                            <Label>Forbidden Words</Label>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {selectedClient.brandProfile.textual?.forbiddenWords?.map((w: string, i: number) => (
                                <Badge key={i} variant="destructive">{w}</Badge>
                              ))}
                            </div>
                          </div>

                          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="w-full mt-4" data-testid="button-import-guidelines">
                                <Link className="w-4 h-4 mr-2" />
                                Re-import from URL
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                              <DialogHeader>
                                <DialogTitle>Import Brand Guidelines</DialogTitle>
                                <DialogDescription>
                                  Re-import brand guidelines from external sources. This will update your existing profile.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="guidelinesUrl">Design Guidelines URL</Label>
                                  <Input
                                    id="guidelinesUrl"
                                    placeholder="https://github.com/company/repo/blob/main/design-guidelines.md"
                                    value={guidelinesUrl}
                                    onChange={(e) => setGuidelinesUrl(e.target.value)}
                                    data-testid="input-guidelines-url"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Link to a markdown file with design guidelines (GitHub, GitLab, etc.)
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="websiteUrl">Website URL</Label>
                                  <Input
                                    id="websiteUrl"
                                    placeholder="https://shield.finance"
                                    value={websiteUrl}
                                    onChange={(e) => setWebsiteUrl(e.target.value)}
                                    data-testid="input-website-url"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Company website to extract brand messaging and content
                                  </p>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  onClick={handleImportGuidelines}
                                  disabled={isImporting || (!guidelinesUrl && !websiteUrl)}
                                  data-testid="button-confirm-import"
                                >
                                  {isImporting ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Importing...
                                    </>
                                  ) : (
                                    <>
                                      <Globe className="w-4 h-4 mr-2" />
                                      Import Guidelines
                                    </>
                                  )}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4">No brand profile configured yet</p>
                          <div className="flex flex-col gap-2 max-w-xs mx-auto">
                            <Button variant="outline" data-testid="button-upload-profile">
                              <Upload className="w-4 h-4 mr-2" />
                              Upload Brand Profile
                            </Button>
                            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="default" data-testid="button-import-guidelines-empty">
                                  <Link className="w-4 h-4 mr-2" />
                                  Import from URL
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[500px]">
                                <DialogHeader>
                                  <DialogTitle>Import Brand Guidelines</DialogTitle>
                                  <DialogDescription>
                                    Import brand guidelines from external sources like GitHub or company websites.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="guidelinesUrl">Design Guidelines URL</Label>
                                    <Input
                                      id="guidelinesUrl"
                                      placeholder="https://github.com/company/repo/blob/main/design-guidelines.md"
                                      value={guidelinesUrl}
                                      onChange={(e) => setGuidelinesUrl(e.target.value)}
                                      data-testid="input-guidelines-url-empty"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Link to a markdown file with design guidelines (GitHub, GitLab, etc.)
                                    </p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="websiteUrl">Website URL</Label>
                                    <Input
                                      id="websiteUrl"
                                      placeholder="https://shield.finance"
                                      value={websiteUrl}
                                      onChange={(e) => setWebsiteUrl(e.target.value)}
                                      data-testid="input-website-url-empty"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Company website to extract brand messaging and content
                                    </p>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={handleImportGuidelines}
                                    disabled={isImporting || (!guidelinesUrl && !websiteUrl)}
                                    data-testid="button-confirm-import-empty"
                                  >
                                    {isImporting ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Importing...
                                      </>
                                    ) : (
                                      <>
                                        <Globe className="w-4 h-4 mr-2" />
                                        Import Guidelines
                                      </>
                                    )}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="visual" className="space-y-4 mt-4">
                      {selectedClient.brandProfile?.visual ? (
                        <div className="space-y-4">
                          <div>
                            <Label>Visual Style</Label>
                            <div className="mt-1 p-2 bg-muted rounded text-sm">
                              {selectedClient.brandProfile.visual?.visualStyle?.description}
                            </div>
                          </div>

                          <div>
                            <Label>Aesthetic</Label>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {selectedClient.brandProfile.visual?.visualStyle?.aesthetic?.map((a: string, i: number) => (
                                <Badge key={i} variant="secondary">{a}</Badge>
                              ))}
                            </div>
                          </div>

                          <div>
                            <Label>Color Palette (Dark Mode)</Label>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              {selectedClient.brandProfile.visual?.colorPalette?.darkMode && 
                                Object.entries(selectedClient.brandProfile.visual.colorPalette.darkMode).map(([key, value]: [string, any]) => (
                                  <div key={key} className="flex items-center gap-2 p-2 bg-muted rounded">
                                    <div 
                                      className="w-6 h-6 rounded border"
                                      style={{ backgroundColor: value?.hex }}
                                    />
                                    <div className="text-xs">
                                      <div className="font-medium">{key}</div>
                                      <div className="text-muted-foreground">{value?.hex}</div>
                                    </div>
                                  </div>
                                ))
                              }
                            </div>
                          </div>

                          <div>
                            <Label>Typography</Label>
                            <div className="mt-1 space-y-1">
                              {selectedClient.brandProfile.visual?.typography?.fonts?.map((f: any, i: number) => (
                                <div key={i} className="p-2 bg-muted rounded text-sm">
                                  <span className="font-medium">{f.family}</span>
                                  <span className="text-muted-foreground"> - {f.usage}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <Label>Cinematic Guidelines</Label>
                            <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                              <div className="p-2 bg-muted rounded">
                                <span className="text-muted-foreground">Resolution:</span> {selectedClient.brandProfile.visual?.cinematicGuidelines?.resolution}
                              </div>
                              <div className="p-2 bg-muted rounded">
                                <span className="text-muted-foreground">Aspect:</span> {selectedClient.brandProfile.visual?.cinematicGuidelines?.aspectRatio}
                              </div>
                              <div className="p-2 bg-muted rounded col-span-2">
                                <span className="text-muted-foreground">Motion:</span> {selectedClient.brandProfile.visual?.cinematicGuidelines?.motionStyle}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">No visual guidelines configured</p>
                      )}
                    </TabsContent>

                    <TabsContent value="generate" className="space-y-4 mt-4">
                      {selectedClient.brandProfile ? (
                        <>
                          {clientLogoUrl && (
                            <Card className="bg-primary/5 border-primary/20">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                  <img 
                                    src={clientLogoUrl} 
                                    alt="Reference Logo" 
                                    className="w-12 h-12 object-contain rounded border bg-white/10"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4 text-green-500" />
                                      <span className="font-medium text-sm">Logo Reference Active</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      All generated assets will use this logo for brand consistency
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-muted-foreground">
                              Generate brand assets using AI based on the brand profile
                            </p>
                            <Button 
                              onClick={generateCompletePackage}
                              disabled={generatingAssets["complete-package"]}
                              data-testid="button-generate-all"
                            >
                              {generatingAssets["complete-package"] ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Wand2 className="w-4 h-4 mr-2" />
                              )}
                              Generate All Assets
                            </Button>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {assetTypes.map((asset) => {
                              const Icon = asset.icon;
                              const isGenerating = generatingAssets[asset.id];
                              const result = generatedResults[asset.id];
                              
                              return (
                                <Card key={asset.id} className="relative">
                                  <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2">
                                      <Icon className="w-5 h-5 text-primary" />
                                      <CardTitle className="text-base">{asset.label}</CardTitle>
                                    </div>
                                    <CardDescription>{asset.description}</CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    <Button 
                                      onClick={() => handleGenerateAsset(asset.id)}
                                      disabled={isGenerating}
                                      className="w-full"
                                      variant={result?.success ? "outline" : "default"}
                                      data-testid={`button-generate-${asset.id}`}
                                    >
                                      {isGenerating ? (
                                        <>
                                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                          Generating...
                                        </>
                                      ) : result?.success ? (
                                        <>
                                          <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                          Generated
                                        </>
                                      ) : result?.error ? (
                                        <>
                                          <XCircle className="w-4 h-4 mr-2 text-red-500" />
                                          Retry
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="w-4 h-4 mr-2" />
                                          Generate
                                        </>
                                      )}
                                    </Button>
                                    {result?.processingTime && (
                                      <p className="text-xs text-muted-foreground mt-2 text-center">
                                        {(result.processingTime / 1000).toFixed(1)}s
                                      </p>
                                    )}
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4">
                            Upload a brand profile first to generate assets
                          </p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="assets" className="space-y-4 mt-4">
                      {assetsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : brandAssetFiles.length > 0 || Object.entries(generatedResults).length > 0 ? (
                        <div className="space-y-4">
                          {brandAssetFiles.length > 0 && (
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <Image className="w-4 h-4" />
                                  Saved Brand Assets ({brandAssetFiles.length})
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                                  {brandAssetFiles.map((file) => (
                                    <div key={file.id} className="relative group" data-testid={`asset-file-${file.id}`}>
                                      {file.mimeType?.startsWith('image/') ? (
                                        <img 
                                          src={`/api/brand-asset-files/download/${file.id}`}
                                          alt={file.originalName}
                                          className="w-full aspect-square object-cover rounded-lg border"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                          }}
                                        />
                                      ) : null}
                                      <div className={`w-full aspect-square bg-muted rounded-lg flex flex-col items-center justify-center ${file.mimeType?.startsWith('image/') ? 'hidden' : ''}`}>
                                        <FileText className="w-8 h-8 text-muted-foreground mb-2" />
                                        <span className="text-xs text-muted-foreground">{file.fileType}</span>
                                      </div>
                                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center p-2">
                                        <span className="text-white text-xs text-center mb-2 line-clamp-2">{file.originalName}</span>
                                        {file.subcategory && (
                                          <Badge variant="secondary" className="text-xs mb-2">{file.subcategory}</Badge>
                                        )}
                                        <a 
                                          href={`/api/brand-asset-files/download/${file.id}`} 
                                          download
                                          className="inline-flex items-center"
                                        >
                                          <Button size="sm" variant="secondary">
                                            <Download className="w-3 h-3 mr-1" />
                                            Download
                                          </Button>
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {Object.entries(generatedResults).map(([type, result]) => (
                            result.success && result.assets && result.assets.length > 0 && (
                              <Card key={type}>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-base capitalize flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-yellow-500" />
                                    {type.replace("-", " ")} (just generated)
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
                                    {result.assets.map((asset, i) => (
                                      <div key={asset.id || i} className="relative group">
                                        {asset.base64 ? (
                                          <img 
                                            src={asset.base64}
                                            alt={`${type} ${i}`}
                                            className="w-full aspect-square object-cover rounded-lg border"
                                          />
                                        ) : asset.url ? (
                                          <img 
                                            src={asset.url}
                                            alt={`${type} ${i}`}
                                            className="w-full aspect-square object-cover rounded-lg border"
                                          />
                                        ) : (
                                          <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center">
                                            <FileText className="w-8 h-8 text-muted-foreground" />
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">
                            No brand assets yet. Use the Generate tab to create brand assets.
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Palette className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a client from the list to manage their brand profile and generate assets</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
