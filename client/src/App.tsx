import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarLayout } from "@/components/sidebar";
import { ActivityPanel } from "@/components/activity-panel";
import NotFound from "@/pages/not-found";
import VideoProjects from "@/pages/video-projects";
import VideoAssembly from "@/pages/video-assembly";
import Settings from "@/pages/settings";
import Dashboard from "@/pages/dashboard";
import ControlTower from "@/pages/control-tower";
import ContentFactory from "@/pages/content-factory";
import Clients from "@/pages/clients";
import BrandAssets from "@/pages/brand-assets";
import BrandFiles from "@/pages/brand-files";

function Router() {
  return (
    <SidebarLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/clients" component={Clients} />
        <Route path="/brand-assets" component={BrandAssets} />
        <Route path="/brand-files" component={BrandFiles} />
        <Route path="/content-factory" component={ContentFactory} />
        <Route path="/video-projects" component={VideoProjects} />
        <Route path="/video-assembly" component={VideoAssembly} />
        <Route path="/video-assembly/:projectId" component={VideoAssembly} />
        <Route path="/settings" component={Settings} />
        <Route path="/control-tower" component={ControlTower} />
        <Route component={NotFound} />
      </Switch>
    </SidebarLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <SonnerToaster position="top-right" richColors />
        <Router />
        <ActivityPanel />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
