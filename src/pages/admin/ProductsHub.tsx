import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import Products from "./Products";
import Categories from "./Categories";
import Brands from "./Brands";

export default function ProductsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "products";

  const handleChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={handleChange} className="w-full">
        <TabsList>
          <TabsTrigger value="products">Бараа</TabsTrigger>
          <TabsTrigger value="categories">Ангилал</TabsTrigger>
          <TabsTrigger value="brands">Брэнд</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-4">
          <Products />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <Categories />
        </TabsContent>
        <TabsContent value="brands" className="mt-4">
          <Brands />
        </TabsContent>
      </Tabs>
    </div>
  );
}
