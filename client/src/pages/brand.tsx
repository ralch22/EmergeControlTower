import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import BrandAssets from "@/pages/brand-assets";
import BrandFiles from "@/pages/brand-files";
import BrandControl from "@/pages/brand-control";

/**
 * Brand — one page, three tabs, scoped to the active workspace via the
 * global X-Client-Id header. Collapses what used to be three separate
 * sidebar entries (Brand Guidelines / Brand Files / Brand Control).
 */
export default function Brand() {
  const [tab, setTab] = useState("guidelines");
  return (
    <div className="p-4 md:p-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="guidelines" data-testid="brand-tab-guidelines">Guidelines</TabsTrigger>
          <TabsTrigger value="files" data-testid="brand-tab-files">Files</TabsTrigger>
          <TabsTrigger value="control" data-testid="brand-tab-control">Control</TabsTrigger>
        </TabsList>
        <TabsContent value="guidelines" className="mt-4">
          <BrandAssets />
        </TabsContent>
        <TabsContent value="files" className="mt-4">
          <BrandFiles />
        </TabsContent>
        <TabsContent value="control" className="mt-4">
          <BrandControl />
        </TabsContent>
      </Tabs>
    </div>
  );
}
