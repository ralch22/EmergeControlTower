import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BriefComposer } from "@/components/brief-composer";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  Home,
  Inbox,
  Library,
  CheckSquare,
  Video,
  Palette,
  Users,
  Settings,
  Menu,
  Shield,
  Activity,
  Zap,
  BarChart3,
  Cog,
  Sparkles,
  Building2,
} from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

// Primary IA — the brand-content-pipeline flow, in order of daily use.
const PRIMARY_NAV: NavItem[] = [
  { path: "/", label: "Home", icon: Home },
  { path: "/briefs", label: "Briefs", icon: Inbox },
  { path: "/library", label: "Library", icon: Library },
  { path: "/review", label: "Review", icon: CheckSquare },
  { path: "/video-projects", label: "Video Projects", icon: Video },
  { path: "/brand", label: "Brand", icon: Palette },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/settings", label: "Settings", icon: Settings },
];

// Agency-internal observability. Hidden unless ?debug=1 (sticky via
// localStorage). Kept mounted so ops still works when summoned.
const OPS_NAV: NavItem[] = [
  { path: "/control-tower", label: "Control Tower", icon: Shield },
  { path: "/provider-health", label: "Provider Health", icon: Activity },
  { path: "/self-healing", label: "Self-Healing", icon: Zap },
  { path: "/test-runner", label: "Test Runner", icon: BarChart3 },
];

function useOpsVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("debug") === "1") {
      localStorage.setItem("emergeOps", "1");
    }
    setVisible(localStorage.getItem("emergeOps") === "1");
  }, []);
  return visible;
}

function NavLink({
  path,
  label,
  icon: Icon,
  isActive,
  onClick,
}: NavItem & { isActive: boolean; onClick?: () => void }) {
  return (
    <Link href={path} onClick={onClick}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 cursor-pointer group",
          isActive
            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
            : "text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent",
        )}
        data-testid={`nav-link-${path.replace("/", "") || "home"}`}
      >
        <Icon
          className={cn(
            "w-5 h-5 flex-shrink-0 transition-colors",
            isActive ? "text-cyan-400" : "text-zinc-500 group-hover:text-cyan-400",
          )}
        />
        <span className="text-sm font-medium truncate">{label}</span>
      </div>
    </Link>
  );
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const [location] = useLocation();
  const opsVisible = useOpsVisible();
  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide" data-testid="text-logo">
              EMERGE
            </h1>
            <p className="text-xs text-zinc-500">Content Studio</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.path} {...item} isActive={isActive(item.path)} onClick={onNavClick} />
        ))}

        {opsVisible && (
          <>
            <div className="my-3 flex items-center gap-2 px-3">
              <Cog className="w-3.5 h-3.5 text-zinc-600" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">Ops</span>
              <div className="flex-1 border-t border-zinc-800/50" />
            </div>
            {OPS_NAV.map((item) => (
              <NavLink key={item.path} {...item} isActive={isActive(item.path)} onClick={onNavClick} />
            ))}
          </>
        )}
      </nav>
    </div>
  );
}

function WorkspaceSwitcher() {
  const { workspaceId, clients, setWorkspace } = useWorkspace();
  return (
    <Select value={workspaceId} onValueChange={setWorkspace}>
      <SelectTrigger
        className="w-[220px] bg-zinc-900 border-zinc-800 text-white"
        data-testid="workspace-switcher"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <SelectValue placeholder="Select workspace" />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
        <SelectItem value="all">All Workspaces</SelectItem>
        {clients.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TopBar({ onNewBrief }: { onNewBrief: () => void }) {
  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      <div className="flex items-center gap-3 pl-12 md:pl-0">
        <WorkspaceSwitcher />
      </div>
      <Button
        onClick={onNewBrief}
        className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium gap-2"
        data-testid="button-new-brief"
      >
        <Sparkles className="w-4 h-4" />
        <span className="hidden sm:inline">New Brief</span>
      </Button>
    </header>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-3 left-3 z-50 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800"
            data-testid="button-mobile-menu"
          >
            <Menu className="w-5 h-5 text-zinc-400" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-zinc-950 border-r border-zinc-800">
          <SidebarContent onNavClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [briefOpen, setBriefOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <aside className="hidden md:flex flex-col h-screen w-64 bg-zinc-950 border-r border-zinc-800 flex-shrink-0">
        <SidebarContent />
      </aside>
      <MobileSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onNewBrief={() => setBriefOpen(true)} />
        <main className="flex-1 overflow-y-auto" data-testid="main-content">
          {children}
        </main>
      </div>
      <BriefComposer open={briefOpen} onOpenChange={setBriefOpen} />
    </div>
  );
}
