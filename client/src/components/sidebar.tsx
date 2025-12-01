import { useState, useEffect } from "react";
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
  ChevronDown,
  Palette,
  FolderOpen,
  Activity,
  Star,
  FilmIcon,
  Cog,
  BarChart3,
  Zap,
} from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

interface NavCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    id: "content",
    label: "Content Production",
    icon: Factory,
    items: [
      { path: "/content-factory", label: "Content Factory", icon: Factory },
      { path: "/video-projects", label: "Video Projects", icon: Video },
      { path: "/video-assembly", label: "Video Assembly", icon: FilmIcon },
    ],
  },
  {
    id: "quality",
    label: "Quality & Review",
    icon: Star,
    items: [
      { path: "/quality-review", label: "Quality Review", icon: Star },
    ],
  },
  {
    id: "brand",
    label: "Brand Management",
    icon: Palette,
    items: [
      { path: "/clients", label: "Clients", icon: Users },
      { path: "/brand-assets", label: "Brand Guidelines", icon: Palette },
      { path: "/brand-files", label: "Brand Files", icon: FolderOpen },
      { path: "/brand-control", label: "Brand Control", icon: Palette },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: Cog,
    items: [
      { path: "/control-tower", label: "Control Tower", icon: Shield },
      { path: "/provider-health", label: "Provider Health", icon: Activity },
      { path: "/self-healing", label: "Self-Healing", icon: Zap },
      { path: "/test-runner", label: "Test Runner", icon: BarChart3 },
      { path: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface NavLinkProps {
  path: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  nested?: boolean;
}

function NavLink({ path, label, icon: Icon, isActive, collapsed, onClick, nested }: NavLinkProps) {
  return (
    <Link href={path} onClick={onClick}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg transition-all duration-200 cursor-pointer group",
          nested ? "px-3 py-2 ml-3" : "px-3 py-2.5",
          isActive
            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
            : "text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent"
        )}
        data-testid={`nav-link-${path.replace("/", "") || "dashboard"}`}
      >
        <Icon
          className={cn(
            "flex-shrink-0 transition-colors",
            nested ? "w-4 h-4" : "w-5 h-5",
            isActive ? "text-cyan-400" : "text-zinc-500 group-hover:text-cyan-400"
          )}
        />
        {!collapsed && (
          <span className={cn("font-medium truncate", nested ? "text-xs" : "text-sm")}>{label}</span>
        )}
      </div>
    </Link>
  );
}

interface CategoryProps {
  category: NavCategory;
  collapsed?: boolean;
  isActive: (path: string) => boolean;
  onNavClick?: () => void;
  expandedCategories: Set<string>;
  toggleCategory: (categoryId: string) => void;
}

function CategorySection({ category, collapsed, isActive, onNavClick, expandedCategories, toggleCategory }: CategoryProps) {
  const isExpanded = expandedCategories.has(category.id);
  const hasActiveChild = category.items.some(item => isActive(item.path));
  const CategoryIcon = category.icon;

  return (
    <div className="mb-1">
      <button
        onClick={() => toggleCategory(category.id)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group",
          hasActiveChild
            ? "text-cyan-400"
            : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
        )}
        data-testid={`nav-category-${category.id}`}
      >
        <CategoryIcon
          className={cn(
            "w-5 h-5 flex-shrink-0 transition-colors",
            hasActiveChild ? "text-cyan-400" : "text-zinc-500 group-hover:text-cyan-400"
          )}
        />
        {!collapsed && (
          <>
            <span className="text-sm font-medium truncate flex-1 text-left">{category.label}</span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-zinc-500 transition-transform duration-200",
                isExpanded && "transform rotate-180"
              )}
            />
          </>
        )}
      </button>
      
      {!collapsed && (
        <div
          className={cn(
            "overflow-hidden transition-all duration-200 ease-in-out",
            isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="mt-1 space-y-0.5 border-l-2 border-zinc-800 ml-5">
            {category.items.map((item) => (
              <NavLink
                key={item.path}
                path={item.path}
                label={item.label}
                icon={item.icon}
                isActive={isActive(item.path)}
                collapsed={collapsed}
                onClick={onNavClick}
                nested
              />
            ))}
          </div>
        </div>
      )}
      
      {collapsed && isExpanded && (
        <div className="mt-1 space-y-0.5">
          {category.items.map((item) => (
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
        </div>
      )}
    </div>
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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    initial.add("content");
    return initial;
  });

  useEffect(() => {
    const activeCategory = navCategories.find(cat =>
      cat.items.some(item => location === item.path || (item.path === "/" && location === "/dashboard"))
    );
    if (activeCategory) {
      setExpandedCategories(prev => {
        if (prev.has(activeCategory.id)) return prev;
        const next = new Set(prev);
        next.add(activeCategory.id);
        return next;
      });
    }
  }, [location]);

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/" || location === "/dashboard";
    }
    return location === path;
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
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
        <NavLink
          path="/"
          label="Dashboard"
          icon={BarChart3}
          isActive={isActive("/")}
          collapsed={collapsed}
          onClick={onNavClick}
        />
        
        <div className="my-3 border-t border-zinc-800/50" />
        
        {navCategories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            collapsed={collapsed}
            isActive={isActive}
            onNavClick={onNavClick}
            expandedCategories={expandedCategories}
            toggleCategory={toggleCategory}
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
