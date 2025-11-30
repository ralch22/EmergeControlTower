import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarLayout } from "@/components/sidebar";
import NotFound from "@/pages/not-found";
import VideoProjects from "@/pages/video-projects";
import Settings from "@/pages/settings";
import Dashboard from "@/pages/dashboard";
import ControlTower from "@/pages/control-tower";
import ContentFactory from "@/pages/content-factory";
import Clients from "@/pages/clients";

function Router() {
  return (
    <SidebarLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/clients" component={Clients} />
        <Route path="/content-factory" component={ContentFactory} />
        <Route path="/video-projects" component={VideoProjects} />
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
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
