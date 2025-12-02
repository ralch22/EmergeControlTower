import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Globe,
  Check,
  X,
  AlertCircle,
  Link2,
  Key,
  User,
} from "lucide-react";

type WordPressConfig = {
  id: number;
  clientId: number;
  endpointUrl: string;
  authType: string;
  username: string | null;
  credentialSecretKey: string | null;
  siteTitle: string | null;
  defaultPostStatus: string;
  autoPublishEnabled: boolean;
  isActive: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
};

type ConnectionTestResult = {
  success: boolean;
  siteTitle?: string;
  siteUrl?: string;
  siteDescription?: string;
  canPublish?: boolean;
  userName?: string;
  error?: string;
};

interface Props {
  clientId: number;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WordPressConfigDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [endpointUrl, setEndpointUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [defaultPostStatus, setDefaultPostStatus] = useState("publish");
  const [autoPublishEnabled, setAutoPublishEnabled] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const { data: config, isLoading: configLoading } = useQuery<WordPressConfig>({
    queryKey: [`/api/wordpress-config/${clientId}`],
    queryFn: async () => {
      const res = await fetch(`/api/wordpress-config/${clientId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (config) {
      setEndpointUrl(config.endpointUrl || "");
      setUsername(config.username || "");
      setDefaultPostStatus(config.defaultPostStatus || "publish");
      setAutoPublishEnabled(config.autoPublishEnabled || false);
    } else {
      setEndpointUrl("");
      setUsername("");
      setPassword("");
      setDefaultPostStatus("publish");
      setAutoPublishEnabled(false);
    }
    setTestResult(null);
  }, [config, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/wordpress-config/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointUrl,
          authType: "application_password",
          username,
          password: password || undefined,
          defaultPostStatus,
          autoPublishEnabled,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save config");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/wordpress-config/${clientId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/wordpress-configs"] });
      
      if (data.credentialSecretKey) {
        toast({
          title: "Configuration saved",
          description: `Add your WordPress password as a secret with key: ${data.credentialSecretKey}`,
        });
      } else {
        toast({
          title: "Configuration saved",
          description: "WordPress settings have been updated",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/wordpress-config/${clientId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      return data as ConnectionTestResult;
    },
    onSuccess: (result) => {
      setTestResult(result);
      if (result.success) {
        toast({
          title: "Connection successful",
          description: `Connected to ${result.siteTitle}`,
        });
      } else {
        toast({
          title: "Connection failed",
          description: result.error,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setTestResult({ success: false, error: error.message });
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/wordpress-config/${clientId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete config");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wordpress-config/${clientId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/wordpress-configs"] });
      onOpenChange(false);
      toast({
        title: "WordPress disconnected",
        description: "WordPress configuration has been removed",
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

  const isConfigured = !!config;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-700" data-testid="wordpress-config-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Globe className="w-5 h-5 text-cyan-400" />
            WordPress Publishing
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Configure WordPress publishing for {clientName}
          </DialogDescription>
        </DialogHeader>

        {configLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {isConfigured && config.siteTitle && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-zinc-300">Connected to:</span>
                  <span className="text-sm font-medium text-white">{config.siteTitle}</span>
                </div>
                {config.lastSyncAt && (
                  <span className="text-xs text-zinc-500">
                    Last sync: {new Date(config.lastSyncAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            {config?.lastError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <span className="text-sm text-red-300">{config.lastError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="endpoint" className="text-zinc-300">
                <Link2 className="w-4 h-4 inline mr-1" />
                GraphQL Endpoint URL
              </Label>
              <Input
                id="endpoint"
                type="url"
                placeholder="https://your-site.com/graphql"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="input-wp-endpoint"
              />
              <p className="text-xs text-zinc-500">
                Requires WPGraphQL plugin installed on your WordPress site
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-zinc-300">
                <User className="w-4 h-4 inline mr-1" />
                Username
              </Label>
              <Input
                id="username"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="input-wp-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">
                <Key className="w-4 h-4 inline mr-1" />
                Application Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={isConfigured ? "••••••••" : "Enter application password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="input-wp-password"
              />
              <p className="text-xs text-zinc-500">
                Create an application password in WordPress: Users → Profile → Application Passwords
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-zinc-300">Default Post Status</Label>
              <Select value={defaultPostStatus} onValueChange={setDefaultPostStatus}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white" data-testid="select-wp-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="publish">Publish immediately</SelectItem>
                  <SelectItem value="draft">Save as draft</SelectItem>
                  <SelectItem value="pending">Pending review</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <div className="space-y-0.5">
                <Label htmlFor="auto-publish" className="text-zinc-300">Auto-publish approved content</Label>
                <p className="text-xs text-zinc-500">
                  Automatically publish blog content when approved
                </p>
              </div>
              <Switch
                id="auto-publish"
                checked={autoPublishEnabled}
                onCheckedChange={setAutoPublishEnabled}
                data-testid="switch-wp-auto-publish"
              />
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg border ${
                testResult.success 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {testResult.success ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <X className="w-4 h-4 text-red-400" />
                  )}
                  <span className={`text-sm font-medium ${
                    testResult.success ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                  </span>
                </div>
                {testResult.success ? (
                  <div className="space-y-1 text-xs text-zinc-400">
                    <p>Site: {testResult.siteTitle}</p>
                    <p>URL: {testResult.siteUrl}</p>
                    {testResult.userName && <p>User: {testResult.userName}</p>}
                    <div className="flex items-center gap-1 mt-2">
                      <Badge variant="outline" className={
                        testResult.canPublish 
                          ? 'bg-green-500/10 text-green-400 border-green-500/30'
                          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                      }>
                        {testResult.canPublish ? 'Can Publish' : 'Read Only'}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-red-300">{testResult.error}</p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between gap-2">
          <div className="flex gap-2">
            {isConfigured && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("Remove WordPress configuration for this client?")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                data-testid="button-wp-delete"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Disconnect
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={!endpointUrl || !username || (!password && !isConfigured) || testMutation.isPending}
              className="border-zinc-600"
              data-testid="button-wp-test"
            >
              {testMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Test Connection
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!endpointUrl || !username || saveMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-500"
              data-testid="button-wp-save"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Configuration
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
