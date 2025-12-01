import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Factory,
  Video,
  Users,
  Shield,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  Palette,
  FolderOpen,
  Activity,
} from "lucide-react";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/content-factory", label: "Content Factory", icon: Factory },
  { path: "/video-projects", label: "Video Projects", icon: Video },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/brand-assets", label: "Brand Guidelines", icon: Palette },
  { path: "/brand-files", label: "Brand Files", icon: FolderOpen },
  { path: "/control-tower", label: "Control Tower", icon: Shield },
  { path: "/provider-health", label: "Provider Health", icon: Activity },
  { path: "/settings", label: "Settings", icon: Settings },
];

interface NavLinkProps {
  path: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

function NavLink({ path, label, icon: Icon, isActive, collapsed, onClick }: NavLinkProps) {
  return (
    <Link href={path} onClick={onClick}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer group",
          isActive
            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
            : "text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent"
        )}
        data-testid={`nav-link-${path.replace("/", "") || "dashboard"}`}
      >
        <Icon
          className={cn(
            "w-5 h-5 flex-shrink-0 transition-colors",
            isActive ? "text-cyan-400" : "text-zinc-500 group-hover:text-cyan-400"
          )}
        />
        {!collapsed && (
          <span className="text-sm font-medium truncate">{label}</span>
        )}
      </div>
    </Link>
  );
}

function SidebarContent({
  collapsed,
  onNavClick,
}: {
  collapsed?: boolean;
  onNavClick?: () => void;
}) {
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/" || location === "/dashboard";
    }
    return location === path;
  };

  return (
    <div className="flex flex-col h-full">
      <div className={cn("p-4 border-b border-zinc-800", collapsed && "px-2")}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide" data-testid="text-logo">
                EMERGE
              </h1>
              <p className="text-xs text-zinc-500" data-testid="text-subtitle">
                Digital Control Tower
              </p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            path={item.path}
            label={item.label}
            icon={item.icon}
            isActive={isActive(item.path)}
            collapsed={collapsed}
            onClick={onNavClick}
          />
        ))}
      </nav>

      <div className={cn("p-4 border-t border-zinc-800", collapsed && "p-2")}>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">EC</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Emerge Control</p>
              <p className="text-xs text-zinc-500 truncate">admin@emerge.io</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-zinc-950 border-r border-zinc-800 transition-all duration-300 flex-shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
      data-testid="sidebar-desktop"
    >
      <SidebarContent collapsed={collapsed} />
      
      <Button
        variant="ghost"
        size="icon"
        className="absolute bottom-20 -right-3 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-400 hover:text-white flex"
        onClick={() => setCollapsed(!collapsed)}
        data-testid="button-toggle-sidebar"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </Button>
    </aside>
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
            className="fixed top-4 left-4 z-50 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800"
            data-testid="button-mobile-menu"
          >
            <Menu className="w-5 h-5 text-zinc-400" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-64 p-0 bg-zinc-950 border-r border-zinc-800"
        >
          <SidebarContent onNavClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <div className="relative">
        <Sidebar />
      </div>
      <MobileSidebar />
      <main className="flex-1 overflow-y-auto" data-testid="main-content">
        {children}
      </main>
    </div>
  );
}
