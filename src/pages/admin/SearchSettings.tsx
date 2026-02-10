import { useState } from "react";
import { Save, Plus, Trash2, GripVertical, Globe, ShoppingBag, Package, Store, Truck, Tag, Box, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AVAILABLE_ICONS: { value: string; label: string; icon: React.ElementType }[] = [
  { value: "Globe", label: "Globe", icon: Globe },
  { value: "ShoppingBag", label: "ShoppingBag", icon: ShoppingBag },
  { value: "Package", label: "Package", icon: Package },
  { value: "Store", label: "Store", icon: Store },
  { value: "Truck", label: "Truck", icon: Truck },
  { value: "Tag", label: "Tag", icon: Tag },
  { value: "Box", label: "Box", icon: Box },
  { value: "Search", label: "Search", icon: SearchIcon },
];

interface ProviderConfig {
  id: string;
  value: string;
  label: string;
  icon: string;
  enabled: boolean;
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { id: "1", value: "", label: "Бүгд", icon: "Globe", enabled: true },
  { id: "2", value: "Taobao", label: "Taobao", icon: "ShoppingBag", enabled: true },
  { id: "3", value: "Poizon", label: "Poizon", icon: "Package", enabled: true },
  { id: "4", value: "local", label: "Бэлэн бараа", icon: "Package", enabled: true },
];

export default function SearchSettings() {
  const [providers, setProviders] = useState<ProviderConfig[]>(DEFAULT_PROVIDERS);
  const [imageSearchEnabled, setImageSearchEnabled] = useState(true);
  const [linkDetectionEnabled, setLinkDetectionEnabled] = useState(true);

  const updateProvider = (id: string, field: keyof ProviderConfig, value: string | boolean) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const addProvider = () => {
    const newId = String(Date.now());
    setProviders((prev) => [
      ...prev,
      { id: newId, value: "", label: "Шинэ", icon: "Globe", enabled: true },
    ]);
  };

  const removeProvider = (id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSave = () => {
    // TODO: Save to admin_settings table
    toast.success("Хайлтын тохиргоо хадгалагдлаа");
  };

  const getIconComponent = (iconName: string) => {
    const found = AVAILABLE_ICONS.find((i) => i.value === iconName);
    return found?.icon || Globe;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Хайлтын тохиргоо</h1>
        <p className="text-muted-foreground mt-1">
          Хайлтын хэсгийн provider сонголт, icon, зургаар хайх зэрэг тохиргоог удирдана.
        </p>
      </div>

      {/* Search Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Нийлүүлэгч (Provider) сонголтууд</CardTitle>
          <CardDescription>
            Хайлтын dropdown-д харагдах нийлүүлэгчдийн жагсаалт, icon болон нэрийг тохируулна.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {providers.map((provider) => {
            const IconComp = getIconComponent(provider.icon);
            return (
              <div
                key={provider.id}
                className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />

                {/* Preview */}
                <div className="flex items-center gap-1.5 shrink-0 w-10 justify-center">
                  <IconComp className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Icon Select */}
                <Select
                  value={provider.icon}
                  onValueChange={(v) => updateProvider(provider.id, "icon", v)}
                >
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {AVAILABLE_ICONS.map((ic) => {
                      const Ic = ic.icon;
                      return (
                        <SelectItem key={ic.value} value={ic.value}>
                          <span className="flex items-center gap-2">
                            <Ic className="h-4 w-4" />
                            {ic.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {/* Label */}
                <Input
                  value={provider.label}
                  onChange={(e) => updateProvider(provider.id, "label", e.target.value)}
                  placeholder="Нэр"
                  className="h-9 flex-1"
                />

                {/* API Value */}
                <Input
                  value={provider.value}
                  onChange={(e) => updateProvider(provider.id, "value", e.target.value)}
                  placeholder="API утга (хоосон = бүгд)"
                  className="h-9 w-32"
                />

                {/* Enabled */}
                <Switch
                  checked={provider.enabled}
                  onCheckedChange={(v) => updateProvider(provider.id, "enabled", v)}
                />

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive shrink-0"
                  onClick={() => removeProvider(provider.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}

          <Button variant="outline" size="sm" className="gap-1" onClick={addProvider}>
            <Plus className="h-4 w-4" />
            Provider нэмэх
          </Button>
        </CardContent>
      </Card>

      {/* Search Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Хайлтын нэмэлт тохиргоо</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Зургаар хайх</Label>
              <p className="text-xs text-muted-foreground">Хайлтын хэсэгт зургаар хайх товч харуулах</p>
            </div>
            <Switch checked={imageSearchEnabled} onCheckedChange={setImageSearchEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Линк таних</Label>
              <p className="text-xs text-muted-foreground">Taobao/Poizon линк оруулахад шууд бараа руу шилжих</p>
            </div>
            <Switch checked={linkDetectionEnabled} onCheckedChange={setLinkDetectionEnabled} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          Хадгалах
        </Button>
      </div>
    </div>
  );
}
