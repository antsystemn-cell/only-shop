import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Package, Globe, Layers } from "lucide-react";
import LocalOrdersTab from "./orders/LocalOrdersTab";
import OtOrdersTab from "./orders/OtOrdersTab";

type SourceTab = "all" | "local" | "ot";

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSource = (searchParams.get("source") as SourceTab) || "all";
  const [sourceTab, setSourceTab] = useState<SourceTab>(initialSource);

  const handleTabChange = (value: string) => {
    const tab = value as SourceTab;
    setSourceTab(tab);
    if (tab === "all") {
      searchParams.delete("source");
    } else {
      searchParams.set("source", tab);
    }
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Захиалга удирдах</h1>
        <p className="text-muted-foreground mt-1">Бүх захиалгуудыг нэг дороос харах, удирдах</p>
      </div>

      {/* Source tabs */}
      <Tabs value={sourceTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all" className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            Бүгд
          </TabsTrigger>
          <TabsTrigger value="local" className="flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            Бэлэн бараа
          </TabsTrigger>
          <TabsTrigger value="ot" className="flex items-center gap-1.5">
            <Globe className="h-4 w-4" />
            OT Захиалга
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6 space-y-8">
          <LocalOrdersTab />
          <div className="border-t pt-6">
            <OtOrdersTab />
          </div>
        </TabsContent>

        <TabsContent value="local" className="mt-6">
          <LocalOrdersTab />
        </TabsContent>

        <TabsContent value="ot" className="mt-6">
          <OtOrdersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
