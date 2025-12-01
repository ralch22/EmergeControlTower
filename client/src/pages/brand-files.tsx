import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  Image,
  Video,
  FileArchive,
  Trash2,
  Download,
  Eye,
  AlertCircle,
  File,
  Folder,
  FolderOpen,
  Plus,
  X,
  ChevronRight,
} from "lucide-react";

type Client = {
  id: number;
  name: string;
  industry: string;
};

type BrandAssetFile = {
  id: number;
  clientId: number;
  category: string;
  subcategory: string | null;
  fileName: string;
  originalName: string;
  filePath: string;
  fileType: string;
  mimeType: string | null;
  fileSize: number;
  purpose: string | null;
  metadata: Record<string, unknown> | null;
  uploadedAt: string;
};

const FILE_CATEGORIES = [
  { id: "textual", label: "Textual Components", icon: FileText, description: "Brand messaging, guidelines, values" },
  { id: "visual", label: "Visual & Design", icon: Image, description: "Colors, fonts, style guides" },
  { id: "assets", label: "Reference Assets", icon: Folder, description: "Logos, videos, infographics, icons" },
];

const ASSET_SUBCATEGORIES = [
  { id: "logos", label: "Logos" },
  { id: "icons", label: "Icon Set" },
  { id: "mood-board", label: "Mood Board" },
  { id: "videos", label: "Reference Videos" },
  { id: "infographics", label: "Infographics" },
  { id: "social", label: "Social Media Images" },
];

const TEXTUAL_PURPOSES = [
  { id: "brand_name", label: "Brand Name & Usage" },
  { id: "tagline", label: "Tagline & Slogan" },
  { id: "brand_story", label: "Brand Story" },
  { id: "values", label: "Brand Values" },
  { id: "personality", label: "Brand Personality" },
  { id: "tone", label: "Tone of Voice" },
  { id: "forbidden_words", label: "Forbidden Words" },
  { id: "keywords", label: "Keywords" },
  { id: "content_goals", label: "Content Goals" },
  { id: "past_successes", label: "Past Successes" },
  { id: "example_phrases", label: "Example Phrases" },
];

const VISUAL_PURPOSES = [
  { id: "visual_style", label: "Visual Style Guide" },
  { id: "color_palette", label: "Color Palette" },
  { id: "fonts", label: "Fonts" },
  { id: "cinematic_guidelines", label: "Cinematic Guidelines" },
  { id: "iconography_guidelines", label: "Iconography Guidelines" },
  { id: "usage_rules", label: "Usage Rules" },
  { id: "accessibility_guidelines", label: "Accessibility Guidelines" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string | null, fileType: string) {
  if (mimeType?.startsWith("image/")) return Image;
  if (mimeType?.startsWith("video/")) return Video;
  if (mimeType?.includes("zip")) return FileArchive;
  if (mimeType?.startsWith("text/") || fileType === "txt" || fileType === "docx") return FileText;
  return File;
}

export default function BrandFilesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("textual");
  const [uploadCategory, setUploadCategory] = useState("textual");
  const [uploadSubcategory, setUploadSubcategory] = useState<string>("");
  const [uploadPurpose, setUploadPurpose] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<BrandAssetFile | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const { data: files = [], isLoading: filesLoading, refetch: refetchFiles } = useQuery<BrandAssetFile[]>({
    queryKey: ["/api/brand-asset-files", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await fetch(`/api/brand-asset-files/${selectedClientId}`);
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    },
    enabled: !!selectedClientId,
  });

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!selectedClientId) throw new Error("No client selected");
      const res = await fetch(`/api/brand-asset-files/${selectedClientId}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-asset-files", selectedClientId] });
      toast({ title: "File uploaded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const res = await fetch(`/api/brand-asset-files/file/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-asset-files", selectedClientId] });
      toast({ title: "File deleted" });
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  const handleFileUpload = useCallback(async (fileList: FileList) => {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", uploadCategory);
      if (uploadSubcategory) formData.append("subcategory", uploadSubcategory);
      if (uploadPurpose) formData.append("purpose", uploadPurpose);
      
      uploadMutation.mutate(formData);
    }
  }, [uploadCategory, uploadSubcategory, uploadPurpose, uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handlePreview = async (file: BrandAssetFile) => {
    setPreviewFile(file);
    if (file.mimeType?.startsWith("text/") || file.mimeType === "application/json") {
      const res = await fetch(`/api/brand-asset-files/content/${file.id}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewContent(data.content);
      }
    }
  };

  const getCategoryFiles = (category: string) => {
    if (category === 'assets') {
      return files.filter(f => f.category === 'assets' || f.category === 'logos');
    }
    return files.filter(f => f.category === category);
  };

  const getCategoryIcon = (category: string) => {
    const cat = FILE_CATEGORIES.find(c => c.id === category);
    return cat?.icon || File;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-cyan-400" />
              Brand Files Manager
            </h1>
            <p className="text-slate-400 mt-1">
              Upload and manage brand assets, guidelines, and reference files
            </p>
          </div>
        </div>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Select Client</CardTitle>
            <CardDescription>Choose a client to manage their brand files</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedClientId?.toString() || ""}
              onValueChange={(val) => setSelectedClientId(parseInt(val))}
            >
              <SelectTrigger 
                className="w-full max-w-md bg-slate-800 border-slate-700 text-white"
                data-testid="select-client"
              >
                <SelectValue placeholder="Select a client..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {clients.map((client) => (
                  <SelectItem
                    key={client.id}
                    value={client.id.toString()}
                    className="text-white hover:bg-slate-700"
                  >
                    {client.name} - {client.industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedClientId && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Upload className="h-5 w-5 text-cyan-400" />
                  Upload Files
                </CardTitle>
                <CardDescription>
                  Add brand assets for {selectedClient?.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-400">Category</Label>
                  <Select value={uploadCategory} onValueChange={setUploadCategory}>
                    <SelectTrigger 
                      className="bg-slate-800 border-slate-700 text-white"
                      data-testid="select-upload-category"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {FILE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="text-white hover:bg-slate-700">
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {uploadCategory === "assets" && (
                  <div className="space-y-2">
                    <Label className="text-slate-400">Subcategory</Label>
                    <Select value={uploadSubcategory} onValueChange={setUploadSubcategory}>
                      <SelectTrigger 
                        className="bg-slate-800 border-slate-700 text-white"
                        data-testid="select-upload-subcategory"
                      >
                        <SelectValue placeholder="Select subcategory..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {ASSET_SUBCATEGORIES.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id} className="text-white hover:bg-slate-700">
                            {sub.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {uploadCategory === "textual" && (
                  <div className="space-y-2">
                    <Label className="text-slate-400">Purpose</Label>
                    <Select value={uploadPurpose} onValueChange={setUploadPurpose}>
                      <SelectTrigger 
                        className="bg-slate-800 border-slate-700 text-white"
                        data-testid="select-upload-purpose"
                      >
                        <SelectValue placeholder="Select purpose..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {TEXTUAL_PURPOSES.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-white hover:bg-slate-700">
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {uploadCategory === "visual" && (
                  <div className="space-y-2">
                    <Label className="text-slate-400">Purpose</Label>
                    <Select value={uploadPurpose} onValueChange={setUploadPurpose}>
                      <SelectTrigger 
                        className="bg-slate-800 border-slate-700 text-white"
                        data-testid="select-upload-visual-purpose"
                      >
                        <SelectValue placeholder="Select purpose..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {VISUAL_PURPOSES.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-white hover:bg-slate-700">
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-slate-700 hover:border-slate-600"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  data-testid="dropzone"
                >
                  <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragging ? "text-cyan-400" : "text-slate-500"}`} />
                  <p className="text-slate-400 text-sm mb-2">
                    Drag & drop files here, or click to browse
                  </p>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    id="file-upload"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    data-testid="input-file"
                  />
                  <label htmlFor="file-upload">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-slate-700 text-slate-300"
                      asChild
                    >
                      <span>
                        <Plus className="h-4 w-4 mr-1" />
                        Select Files
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-slate-500 mt-2">
                    Text: 50KB • Images: 10MB • Videos: 100MB • Archives: 50MB
                  </p>
                </div>

                {uploadMutation.isPending && (
                  <div className="flex items-center gap-2 text-cyan-400">
                    <div className="animate-spin h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full" />
                    <span className="text-sm">Uploading...</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Uploaded Files</CardTitle>
                <CardDescription>
                  {files.length} files for {selectedClient?.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                  <TabsList className="bg-slate-800 border-slate-700">
                    {FILE_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const count = getCategoryFiles(cat.id).length;
                      return (
                        <TabsTrigger
                          key={cat.id}
                          value={cat.id}
                          className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
                          data-testid={`tab-${cat.id}`}
                        >
                          <Icon className="h-4 w-4 mr-1" />
                          {cat.label}
                          {count > 0 && (
                            <Badge variant="secondary" className="ml-1 bg-slate-700 text-xs">
                              {count}
                            </Badge>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {FILE_CATEGORIES.map((cat) => (
                    <TabsContent key={cat.id} value={cat.id} className="mt-4">
                      <ScrollArea className="h-[400px]">
                        {getCategoryFiles(cat.id).length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                            <AlertCircle className="h-8 w-8 mb-2" />
                            <p>No {cat.label.toLowerCase()} uploaded yet</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {getCategoryFiles(cat.id).map((file) => {
                              const Icon = getFileIcon(file.mimeType, file.fileType);
                              return (
                                <div
                                  key={file.id}
                                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600"
                                  data-testid={`file-item-${file.id}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-700 rounded">
                                      <Icon className="h-5 w-5 text-cyan-400" />
                                    </div>
                                    <div>
                                      <p className="text-white font-medium text-sm">{file.originalName}</p>
                                      <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span>{formatFileSize(file.fileSize)}</span>
                                        {file.purpose && (
                                          <>
                                            <ChevronRight className="h-3 w-3" />
                                            <Badge variant="outline" className="text-xs border-slate-600">
                                              {file.purpose.replace(/_/g, " ")}
                                            </Badge>
                                          </>
                                        )}
                                        {file.subcategory && (
                                          <>
                                            <ChevronRight className="h-3 w-3" />
                                            <Badge variant="outline" className="text-xs border-slate-600">
                                              {file.subcategory}
                                            </Badge>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {(file.mimeType?.startsWith("text/") || file.mimeType === "application/json") && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-white"
                                        onClick={() => handlePreview(file)}
                                        data-testid={`btn-preview-${file.id}`}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-400 hover:text-white"
                                      asChild
                                    >
                                      <a 
                                        href={`/api/brand-asset-files/download/${file.id}`}
                                        download
                                        data-testid={`btn-download-${file.id}`}
                                      >
                                        <Download className="h-4 w-4" />
                                      </a>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-400 hover:text-red-400"
                                      onClick={() => deleteMutation.mutate(file.id)}
                                      data-testid={`btn-delete-${file.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}

        {!selectedClientId && clients.length === 0 && !clientsLoading && (
          <Card className="bg-slate-900/50 border-slate-800 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Clients Found</h3>
              <p className="text-slate-400 text-center max-w-md">
                Create a client first before uploading brand files.
              </p>
            </CardContent>
          </Card>
        )}

        <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan-400" />
                {previewFile?.originalName}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[60vh]">
              <pre className="p-4 bg-slate-800 rounded text-sm text-slate-300 whitespace-pre-wrap font-mono">
                {previewContent}
              </pre>
            </ScrollArea>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPreviewFile(null)}
                className="border-slate-700"
              >
                Close
              </Button>
              <Button
                asChild
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                <a href={`/api/brand-asset-files/download/${previewFile?.id}`} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
