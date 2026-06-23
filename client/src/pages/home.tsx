import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  Building2,
  CheckSquare,
  Inbox,
  Video,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface ApprovalItem {
  id: number;
  clientId?: number | null;
  status: string;
}
interface ContentRun {
  runId: string;
  clientId: number;
  status: string;
}
interface VideoProjectLite {
  projectId?: string;
  id?: number;
  title?: string;
  name?: string;
  status?: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  href?: string;
}) {
  const body = (
    <Card className="bg-zinc-900 border-zinc-800 p-5 hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
          <Icon className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-zinc-500">{label}</p>
        </div>
      </div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Portfolio() {
  const { clients, setWorkspace } = useWorkspace();
  const { data: approvals = [] } = useQuery<ApprovalItem[]>({ queryKey: ["/api/approvals"] });

  const pendingByClient = (id: number) =>
    approvals.filter((a) => a.status === "pending" && a.clientId === id).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Workspaces</h1>
        <p className="text-sm text-zinc-500">
          {clients.length} {clients.length === 1 ? "client" : "clients"} · pick one to start producing
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((c) => {
          const pending = pendingByClient(c.id);
          return (
            <Card
              key={c.id}
              className="bg-zinc-900 border-zinc-800 p-5 hover:border-cyan-500/40 transition-colors cursor-pointer"
              onClick={() => setWorkspace(String(c.id))}
              data-testid={`workspace-card-${c.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/30 to-purple-600/30 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-cyan-400" />
                </div>
                {pending > 0 && (
                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">
                    {pending} to review
                  </Badge>
                )}
              </div>
              <h3 className="text-white font-semibold mt-3">{c.name}</h3>
              {c.vertical && (
                <p className="text-xs text-zinc-500 capitalize">{c.vertical.replace("_", " ")}</p>
              )}
              <div className="flex items-center gap-1 text-cyan-400 text-sm mt-3">
                Open workspace <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Card>
          );
        })}

        {clients.length === 0 && (
          <Card className="bg-zinc-900 border-zinc-800 p-8 text-center col-span-full">
            <p className="text-zinc-400">No clients yet.</p>
            <Link href="/clients">
              <Button className="mt-3 bg-cyan-500 hover:bg-cyan-400 text-zinc-950">Add a client</Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}

function SingleWorkspace() {
  const { activeClient } = useWorkspace();
  const { data: approvals = [] } = useQuery<ApprovalItem[]>({ queryKey: ["/api/approvals"] });
  const { data: runs = [] } = useQuery<ContentRun[]>({ queryKey: ["/api/content-runs"] });
  const { data: projects = [] } = useQuery<VideoProjectLite[]>({ queryKey: ["/api/video-projects"] });

  const pending = approvals.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{activeClient?.name ?? "Workspace"}</h1>
          <p className="text-sm text-zinc-500">
            {activeClient?.vertical
              ? activeClient.vertical.replace("_", " ")
              : "Today's snapshot"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={CheckSquare} label="Pending review" value={pending} href="/review" />
        <StatCard icon={Inbox} label="Briefs" value={runs.length} href="/briefs" />
        <StatCard icon={Video} label="Video projects" value={projects.length} href="/video-projects" />
      </div>

      <Card className="bg-gradient-to-br from-cyan-500/10 to-purple-600/10 border-cyan-500/20 p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-cyan-400" />
          <div>
            <h3 className="text-white font-semibold">Produce content for {activeClient?.name}</h3>
            <p className="text-sm text-zinc-400">
              Use <span className="text-cyan-400">New Brief</span> in the top bar — pick an archetype, give it a topic, generate.
            </p>
          </div>
        </div>
      </Card>

      {projects.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 mb-2">Recent video projects</h2>
          <div className="space-y-2">
            {projects.slice(0, 5).map((p, i) => (
              <Link key={p.projectId ?? p.id ?? i} href={p.projectId ? `/video-assembly/${p.projectId}` : "/video-projects"}>
                <Card className="bg-zinc-900 border-zinc-800 p-3 flex items-center justify-between hover:border-zinc-700 transition-colors">
                  <span className="text-white truncate">{p.title ?? p.name ?? p.projectId ?? "Untitled"}</span>
                  {p.status && (
                    <Badge variant="outline" className="border-zinc-700 text-zinc-400">{p.status}</Badge>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { workspaceId } = useWorkspace();
  return (
    <div className="p-4 md:p-6">
      {workspaceId === "all" ? <Portfolio /> : <SingleWorkspace />}
    </div>
  );
}
