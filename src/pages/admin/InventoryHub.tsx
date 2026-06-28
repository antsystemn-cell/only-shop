import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Boxes, History } from "lucide-react";
import Inventory from "./Inventory";
import StockMovements from "./StockMovements";

export default function InventoryHub() {
  const [tab, setTab] = useState("inventory");
  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="inventory">
            <Boxes className="h-4 w-4 mr-2" /> Үлдэгдэл
          </TabsTrigger>
          <TabsTrigger value="movements">
            <History className="h-4 w-4 mr-2" /> Үлдэгдлийн хөдөлгөөн
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inventory" className="mt-4">
          <Inventory />
        </TabsContent>
        <TabsContent value="movements" className="mt-4">
          <StockMovements />
        </TabsContent>
      </Tabs>
    </div>
  );
}
