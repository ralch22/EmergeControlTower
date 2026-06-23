import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { SidebarLayout } from "@/components/sidebar";
import { ActivityPanel } from "@/components/activity-panel";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Briefs from "@/pages/briefs";
import Brand from "@/pages/brand";
import VideoProjects from "@/pages/video-projects";
import VideoAssembly from "@/pages/video-assembly";
import Settings from "@/pages/settings";
import ControlTower from "@/pages/control-tower";
import ContentFactory from "@/pages/content-factory";
import Clients from "@/pages/clients";
import BrandAssets from "@/pages/brand-assets";
import BrandFiles from "@/pages/brand-files";
import ProviderHealth from "@/pages/provider-health";
import QualityReview from "@/pages/quality-review";
import BrandControl from "@/pages/brand-control";
import SelfHealing from "@/pages/self-healing";
import TestRunner from "@/pages/test-runner";

function Router() {
  return (
    <SidebarLayout>
      <Switch>
        {/* Primary IA */}
        <Route path="/" component={Home} />
        <Route path="/briefs" component={Briefs} />
        <Route path="/library" component={ContentFactory} />
        <Route path="/review" component={QualityReview} />
        <Route path="/video-projects" component={VideoProjects} />
        <Route path="/video-assembly" component={VideoAssembly} />
        <Route path="/video-assembly/:projectId" component={VideoAssembly} />
        <Route path="/brand" component={Brand} />
        <Route path="/clients" component={Clients} />
        <Route path="/settings" component={Settings} />

        {/* Legacy path redirects (preserve old bookmarks) */}
        <Route path="/dashboard"><Redirect to="/" /></Route>
        <Route path="/content-factory"><Redirect to="/library" /></Route>
        <Route path="/quality-review"><Redirect to="/review" /></Route>
        <Route path="/brand-assets"><Redirect to="/brand" /></Route>
        <Route path="/brand-files"><Redirect to="/brand" /></Route>
        <Route path="/brand-control"><Redirect to="/brand" /></Route>

        {/* Ops (hidden from nav unless ?debug=1; routes stay mounted) */}
        <Route path="/control-tower" component={ControlTower} />
        <Route path="/provider-health" component={ProviderHealth} />
        <Route path="/self-healing" component={SelfHealing} />
        <Route path="/test-runner" component={TestRunner} />

        {/* Standalone brand sub-pages still reachable directly if needed */}
        <Route path="/brand/guidelines" component={BrandAssets} />
        <Route path="/brand/files" component={BrandFiles} />
        <Route path="/brand/control" component={BrandControl} />

        <Route component={NotFound} />
      </Switch>
    </SidebarLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WorkspaceProvider>
          <Toaster />
          <SonnerToaster position="top-right" richColors />
          <Router />
          <ActivityPanel />
        </WorkspaceProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
