import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Palette,
  Type,
  Video,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Eye,
  Image,
  AlertCircle,
} from "lucide-react";

type Client = {
  id: number;
  name: string;
  industry: string;
};

type BrandAssets = {
  id: number;
  clientId: number;
  visualStyle: string | null;
  colorPalette: string[] | null;
  fonts: string[] | null;
  referenceAssets: Record<string, string> | null;
  cinematicGuidelines: string | null;
  forbiddenWords: string[] | null;
  examplePhrases: string[] | null;
  createdAt: string;
  updatedAt: string;
};

const PRESET_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Playfair Display",
  "Poppins", "Raleway", "Source Sans Pro", "Oswald", "Merriweather", "Ubuntu"
];

const PRESET_VISUAL_STYLES = [
  "Cinematic with warm tones, high contrast, slow-motion transitions",
  "Modern minimalist with clean lines and subtle animations",
  "Bold and vibrant with dynamic camera movements",
  "Soft and ethereal with pastel colors and gentle fades",
  "Professional corporate with sleek graphics and smooth transitions",
  "Retro vintage with film grain and warm color grading",
];

export default function BrandAssetsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [colorInput, setColorInput] = useState("");
  const [fontInput, setFontInput] = useState("");
  
  const [formData, setFormData] = useState<{
    visualStyle: string;
    colorPalette: string[];
    fonts: string[];
    cinematicGuidelines: string;
    forbiddenWords: string[];
    examplePhrases: string[];
  }>({
    visualStyle: "",
    colorPalette: [],
    fonts: [],
    cinematicGuidelines: "",
    forbiddenWords: [],
    examplePhrases: [],
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const { data: brandAssets, isLoading: assetsLoading } = useQuery<BrandAssets>({
    queryKey: ["/api/brand-assets", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const res = await fetch(`/api/brand-assets/${selectedClientId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch brand assets");
      return res.json();
    },
    enabled: !!selectedClientId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId) throw new Error("No client selected");
      
      const res = await fetch(`/api/brand-assets/${selectedClientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          ...formData,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-assets", selectedClientId] });
      setIsEditing(false);
      toast({
        title: "Brand assets saved",
        description: "Visual and cinematic guidelines have been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving brand assets",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId) throw new Error("No client selected");
      
      const res = await fetch(`/api/brand-assets/${selectedClientId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete brand assets");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-assets", selectedClientId] });
      resetForm();
      toast({
        title: "Brand assets deleted",
        description: "Visual guidelines have been removed for this client",
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

  const resetForm = () => {
    setFormData({
      visualStyle: "",
      colorPalette: [],
      fonts: [],
      cinematicGuidelines: "",
      forbiddenWords: [],
      examplePhrases: [],
    });
    setIsEditing(false);
  };

  const loadExistingData = () => {
    if (brandAssets) {
      setFormData({
        visualStyle: brandAssets.visualStyle || "",
        colorPalette: brandAssets.colorPalette || [],
        fonts: brandAssets.fonts || [],
        cinematicGuidelines: brandAssets.cinematicGuidelines || "",
        forbiddenWords: brandAssets.forbiddenWords || [],
        examplePhrases: brandAssets.examplePhrases || [],
      });
    }
    setIsEditing(true);
  };

  const addColor = () => {
    const color = colorInput.trim();
    if (color && !formData.colorPalette.includes(color)) {
      setFormData(prev => ({
        ...prev,
        colorPalette: [...prev.colorPalette, color],
      }));
      setColorInput("");
    }
  };

  const removeColor = (color: string) => {
    setFormData(prev => ({
      ...prev,
      colorPalette: prev.colorPalette.filter(c => c !== color),
    }));
  };

  const addFont = (font: string) => {
    if (font && !formData.fonts.includes(font)) {
      setFormData(prev => ({
        ...prev,
        fonts: [...prev.fonts, font],
      }));
    }
  };

  const removeFont = (font: string) => {
    setFormData(prev => ({
      ...prev,
      fonts: prev.fonts.filter(f => f !== font),
    }));
  };

  const isValidHexColor = (color: string) => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-slate-950 p-6" data-testid="brand-assets-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Palette className="h-8 w-8 text-cyan-400" />
              Brand Assets
            </h1>
            <p className="text-slate-400 mt-1">
              Manage visual styles, color palettes, and cinematic guidelines for consistent content generation
            </p>
          </div>
        </div>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-cyan-400" />
              Select Client
            </CardTitle>
            <CardDescription>
              Choose a client to manage their brand visual guidelines
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedClientId?.toString() || ""}
              onValueChange={(value) => {
                setSelectedClientId(parseInt(value));
                resetForm();
              }}
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
                    data-testid={`client-option-${client.id}`}
                  >
                    {client.name} - {client.industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedClientId && (
          <>
            {!isEditing && brandAssets && (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-white">
                      Brand Guidelines for {selectedClient?.name}
                    </CardTitle>
                    <CardDescription>
                      Current visual and cinematic settings
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadExistingData}
                      className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                      data-testid="btn-edit-brand"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                          data-testid="btn-delete-brand"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-slate-900 border-slate-800">
                        <DialogHeader>
                          <DialogTitle className="text-white">Delete Brand Assets?</DialogTitle>
                        </DialogHeader>
                        <p className="text-slate-400">
                          This will remove all visual and cinematic guidelines for {selectedClient?.name}. 
                          This action cannot be undone.
                        </p>
                        <DialogFooter>
                          <Button
                            variant="destructive"
                            onClick={() => deleteMutation.mutate()}
                            data-testid="btn-confirm-delete"
                          >
                            Delete
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {brandAssets.visualStyle && (
                    <div>
                      <Label className="text-slate-400">Visual Style</Label>
                      <p className="text-white mt-1">{brandAssets.visualStyle}</p>
                    </div>
                  )}
                  
                  {brandAssets.colorPalette && brandAssets.colorPalette.length > 0 && (
                    <div>
                      <Label className="text-slate-400">Color Palette</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {brandAssets.colorPalette.map((color, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded border border-slate-700"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-white text-sm">{color}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {brandAssets.fonts && brandAssets.fonts.length > 0 && (
                    <div>
                      <Label className="text-slate-400">Fonts</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {brandAssets.fonts.map((font, idx) => (
                          <Badge key={idx} variant="secondary" className="bg-slate-800 text-white">
                            <Type className="h-3 w-3 mr-1" />
                            {font}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {brandAssets.cinematicGuidelines && (
                    <div>
                      <Label className="text-slate-400">Cinematic Guidelines</Label>
                      <p className="text-white mt-1">{brandAssets.cinematicGuidelines}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!isEditing && !brandAssets && !assetsLoading && (
              <Card className="bg-slate-900/50 border-slate-800 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-slate-600 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Brand Assets</h3>
                  <p className="text-slate-400 text-center max-w-md mb-4">
                    {selectedClient?.name} doesn't have brand visual guidelines yet. 
                    Create them to ensure consistent content generation.
                  </p>
                  <Button
                    onClick={() => setIsEditing(true)}
                    className="bg-cyan-600 hover:bg-cyan-700"
                    data-testid="btn-create-brand"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Brand Guidelines
                  </Button>
                </CardContent>
              </Card>
            )}

            {isEditing && (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Palette className="h-5 w-5 text-cyan-400" />
                      {brandAssets ? "Edit" : "Create"} Brand Guidelines
                    </CardTitle>
                    <CardDescription>
                      Configure visual and cinematic settings for {selectedClient?.name}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    className="text-slate-400 hover:text-white"
                    data-testid="btn-cancel-edit"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-white">Visual Style</Label>
                    <Textarea
                      value={formData.visualStyle}
                      onChange={(e) => setFormData(prev => ({ ...prev, visualStyle: e.target.value }))}
                      placeholder="Describe the overall visual aesthetic (e.g., 'cinematic with warm tones, high contrast, slow-motion transitions')"
                      className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
                      data-testid="input-visual-style"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {PRESET_VISUAL_STYLES.map((style, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => setFormData(prev => ({ ...prev, visualStyle: style }))}
                          className="text-xs border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white"
                        >
                          {style.substring(0, 30)}...
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Color Palette</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Input
                          value={colorInput}
                          onChange={(e) => setColorInput(e.target.value)}
                          placeholder="#FF0000 or color name"
                          className="bg-slate-800 border-slate-700 text-white pr-12"
                          onKeyDown={(e) => e.key === "Enter" && addColor()}
                          data-testid="input-color"
                        />
                        {isValidHexColor(colorInput) && (
                          <div
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded border border-slate-600"
                            style={{ backgroundColor: colorInput }}
                          />
                        )}
                      </div>
                      <input
                        type="color"
                        value={colorInput.startsWith("#") ? colorInput : "#000000"}
                        onChange={(e) => setColorInput(e.target.value)}
                        className="w-12 h-10 rounded cursor-pointer bg-slate-800 border border-slate-700"
                        data-testid="color-picker"
                      />
                      <Button
                        onClick={addColor}
                        variant="secondary"
                        className="bg-slate-700 hover:bg-slate-600"
                        data-testid="btn-add-color"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.colorPalette.map((color, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-slate-800 rounded px-2 py-1 border border-slate-700"
                        >
                          <div
                            className="w-5 h-5 rounded border border-slate-600"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-white text-sm">{color}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeColor(color)}
                            className="h-5 w-5 p-0 text-slate-400 hover:text-red-400"
                            data-testid={`btn-remove-color-${idx}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Fonts</Label>
                    <Select onValueChange={addFont}>
                      <SelectTrigger 
                        className="w-full max-w-md bg-slate-800 border-slate-700 text-white"
                        data-testid="select-font"
                      >
                        <SelectValue placeholder="Add a font..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {PRESET_FONTS.filter(f => !formData.fonts.includes(f)).map((font) => (
                          <SelectItem
                            key={font}
                            value={font}
                            className="text-white hover:bg-slate-700"
                          >
                            {font}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.fonts.map((font, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="bg-slate-800 text-white border border-slate-700 cursor-pointer hover:bg-slate-700"
                          onClick={() => removeFont(font)}
                          data-testid={`badge-font-${idx}`}
                        >
                          <Type className="h-3 w-3 mr-1" />
                          {font}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white flex items-center gap-2">
                      <Video className="h-4 w-4 text-cyan-400" />
                      Cinematic Guidelines
                    </Label>
                    <Textarea
                      value={formData.cinematicGuidelines}
                      onChange={(e) => setFormData(prev => ({ ...prev, cinematicGuidelines: e.target.value }))}
                      placeholder="Video-specific rules (e.g., 'Use 16:9 aspect ratio, dramatic lighting, orchestral music, slow-motion for key moments')"
                      className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                      data-testid="input-cinematic"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                    <Button
                      variant="outline"
                      onClick={resetForm}
                      className="border-slate-700 text-slate-400"
                      data-testid="btn-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                      className="bg-cyan-600 hover:bg-cyan-700"
                      data-testid="btn-save-brand"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saveMutation.isPending ? "Saving..." : "Save Brand Assets"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!selectedClientId && clients.length === 0 && !clientsLoading && (
          <Card className="bg-slate-900/50 border-slate-800 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Clients Found</h3>
              <p className="text-slate-400 text-center max-w-md">
                Create a client first before setting up brand visual guidelines.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
