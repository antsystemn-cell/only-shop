import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Boxes, History, Plus } from "lucide-react";
import Inventory from "./Inventory";
import StockMovements from "./StockMovements";

export default function InventoryHub() {
  const [tab, setTab] = useState("inventory");
  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="inventory">
              <Boxes className="h-4 w-4 mr-2" /> Үлдэгдэл
            </TabsTrigger>
            <TabsTrigger value="movements">
              <History className="h-4 w-4 mr-2" /> Үлдэгдлийн хөдөлгөөн
            </TabsTrigger>
          </TabsList>
          <Button asChild size="sm">
            <Link to="/admin/products?tab=products&new=1">
              <Plus className="h-4 w-4 mr-1" /> Бараа нэмэх
            </Link>
          </Button>
        </div>
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
