import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useWorkspace } from "@/contexts/workspace-context";
import { archetypesForVertical } from "@shared/archetypes";
import { Sparkles } from "lucide-react";

/**
 * Brief Composer — the single entry point for "make me content".
 * Pick workspace → archetype (menu driven by the client's vertical) →
 * topic → generate. Replaces the generation controls that were buried
 * inside the Content Factory page.
 */
export function BriefComposer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspaceId, activeClient, clients } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // The brief targets a concrete client. Default to the active workspace;
  // if "all" is selected, the operator picks one here.
  const [clientId, setClientId] = useState<string>(
    workspaceId !== "all" ? workspaceId : "",
  );
  const [archetypeKey, setArchetypeKey] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState("");

  useEffect(() => {
    if (workspaceId !== "all") setClientId(workspaceId);
  }, [workspaceId]);

  const selectedClient =
    clients.find((c) => String(c.id) === clientId) ?? activeClient;
  const archetypes = useMemo(
    () => archetypesForVertical(selectedClient?.vertical),
    [selectedClient?.vertical],
  );
  const archetype = archetypes.find((a) => a.key === archetypeKey);

  const generate = useMutation({
    mutationFn: async () => {
      const a = archetype;
      const res = await apiRequest("POST", "/api/content/generate-single", {
        clientId: parseInt(clientId, 10),
        contentType: "video_script",
        archetype: a?.key,
        topic: topic.trim(),
        brief:
          brief.trim() ||
          (a
            ? `${a.label}: ${a.description} Voice: ${a.voiceTone}. ${a.scenes} scenes, ~${a.durationSec}s, render via ${a.providerPreference}.`
            : undefined),
        targetLength: "medium",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-runs"] });
      toast({
        title: "Brief submitted",
        description: `${archetype?.label ?? "Content"} is generating for ${selectedClient?.name ?? "the client"}.`,
      });
      setTopic("");
      setBrief("");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      // Surface the cost-gate's HTTP 402 distinctly.
      const isBudget = err.message.startsWith("402");
      toast({
        title: isBudget ? "Budget exceeded" : "Generation failed",
        description: isBudget
          ? "This brief would exceed the daily/provider budget. Raise the budget or wait for the daily reset."
          : err.message,
        variant: "destructive",
      });
    },
  });

  const canSubmit = clientId && archetypeKey && topic.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-zinc-950 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            New Brief
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Pick a workspace and archetype, give it a topic, and generate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-zinc-300">Workspace</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800" data-testid="brief-client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                {clients.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                    {c.vertical ? ` · ${c.vertical.replace("_", " ")}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-300">Archetype</Label>
            <Select value={archetypeKey} onValueChange={setArchetypeKey}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800" data-testid="brief-archetype">
                <SelectValue placeholder="Pick a content shape" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                {archetypes.map((a) => (
                  <SelectItem key={a.key} value={a.key}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {archetype && (
              <p className="text-xs text-zinc-500 pt-1">
                {archetype.description}{" "}
                <Badge variant="outline" className="ml-1 border-zinc-700 text-zinc-400">
                  {archetype.scenes} scenes · {archetype.durationSec}s · {archetype.providerPreference}
                </Badge>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-300">Topic</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Marina-view 2BR reveal at Sobha Hartland"
              className="bg-zinc-900 border-zinc-800"
              data-testid="brief-topic"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-300">Extra brief (optional)</Label>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Anything specific — angle, must-include details, CTA…"
              className="bg-zinc-900 border-zinc-800 min-h-[72px]"
              data-testid="brief-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-zinc-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={() => generate.mutate()}
            disabled={!canSubmit || generate.isPending}
            className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium"
            data-testid="brief-submit"
          >
            {generate.isPending ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
