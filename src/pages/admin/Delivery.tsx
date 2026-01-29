import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Truck,
  Loader2,
  MapPin,
} from "lucide-react";

interface DeliveryZone {
  id: string;
  name: string;
  zone_type: string;
  parent_id: string | null;
  standard_price: number;
  express_price: number | null;
  rural_price: number | null;
  standard_days: number;
  express_days: number | null;
  rural_days: number | null;
  is_active: boolean;
}

const zoneTypes = [
  { value: "ub_district", label: "УБ дүүрэг" },
  { value: "aimag", label: "Аймаг" },
  { value: "soum", label: "Сум" },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("mn-MN").format(amount) + "₮";
}

export default function Delivery() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    zone_type: "ub_district",
    standard_price: "",
    express_price: "",
    rural_price: "",
    standard_days: "3",
    express_days: "1",
    rural_days: "5",
    is_active: true,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch delivery zones
  const { data: zones, isLoading } = useQuery({
    queryKey: ["admin", "delivery-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .order("zone_type")
        .order("name");
      if (error) throw error;
      return data as DeliveryZone[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const zoneData = {
        name: data.name,
        zone_type: data.zone_type,
        standard_price: parseFloat(data.standard_price) || 0,
        express_price: data.express_price ? parseFloat(data.express_price) : null,
        rural_price: data.rural_price ? parseFloat(data.rural_price) : null,
        standard_days: parseInt(data.standard_days) || 3,
        express_days: data.express_days ? parseInt(data.express_days) : null,
        rural_days: data.rural_days ? parseInt(data.rural_days) : null,
        is_active: data.is_active,
      };

      if (data.id) {
        const { error } = await supabase
          .from("delivery_zones")
          .update(zoneData)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("delivery_zones")
          .insert([zoneData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "delivery-zones"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingZone ? "Бүс шинэчлэгдлээ" : "Бүс нэмэгдлээ",
        description: "Амжилттай хадгаллаа",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("delivery_zones")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "delivery-zones"] });
      toast({
        title: "Бүс устгагдлаа",
        description: "Амжилттай устгалаа",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      zone_type: "ub_district",
      standard_price: "",
      express_price: "",
      rural_price: "",
      standard_days: "3",
      express_days: "1",
      rural_days: "5",
      is_active: true,
    });
    setEditingZone(null);
  };

  const handleEdit = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      zone_type: zone.zone_type,
      standard_price: zone.standard_price.toString(),
      express_price: zone.express_price?.toString() || "",
      rural_price: zone.rural_price?.toString() || "",
      standard_days: zone.standard_days.toString(),
      express_days: zone.express_days?.toString() || "",
      rural_days: zone.rural_days?.toString() || "",
      is_active: zone.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      ...formData,
      id: editingZone?.id,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Энэ хүргэлтийн бүсийг устгахдаа итгэлтэй байна уу?")) {
      deleteMutation.mutate(id);
    }
  };

  const getZoneTypeBadge = (type: string) => {
    const t = zoneTypes.find((z) => z.value === type);
    const colors: Record<string, string> = {
      ub_district: "bg-blue-100 text-blue-800",
      aimag: "bg-green-100 text-green-800",
      soum: "bg-orange-100 text-orange-800",
    };
    return (
      <Badge className={colors[type] || "bg-gray-100 text-gray-800"}>
        {t?.label || type}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Хүргэлтийн тохиргоо</h1>
          <p className="text-muted-foreground mt-1">
            Хүргэлтийн бүс болон үнэ тохируулах
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Бүс нэмэх
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingZone ? "Бүс засах" : "Шинэ бүс нэмэх"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Бүсийн нэр *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Баянзүрх дүүрэг"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zone_type">Төрөл</Label>
                  <Select
                    value={formData.zone_type}
                    onValueChange={(value) => setFormData({ ...formData, zone_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {zoneTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium">Хүргэлтийн үнэ</h4>
                <div className="grid gap-4 grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="standard_price">Стандарт (₮)</Label>
                    <Input
                      id="standard_price"
                      type="number"
                      value={formData.standard_price}
                      onChange={(e) => setFormData({ ...formData, standard_price: e.target.value })}
                      placeholder="3000"
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="express_price">Түргэн (₮)</Label>
                    <Input
                      id="express_price"
                      type="number"
                      value={formData.express_price}
                      onChange={(e) => setFormData({ ...formData, express_price: e.target.value })}
                      placeholder="6000"
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rural_price">Орон нутаг (₮)</Label>
                    <Input
                      id="rural_price"
                      type="number"
                      value={formData.rural_price}
                      onChange={(e) => setFormData({ ...formData, rural_price: e.target.value })}
                      placeholder="10000"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium">Хүргэлтийн хугацаа (өдөр)</h4>
                <div className="grid gap-4 grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="standard_days">Стандарт</Label>
                    <Input
                      id="standard_days"
                      type="number"
                      value={formData.standard_days}
                      onChange={(e) => setFormData({ ...formData, standard_days: e.target.value })}
                      placeholder="3"
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="express_days">Түргэн</Label>
                    <Input
                      id="express_days"
                      type="number"
                      value={formData.express_days}
                      onChange={(e) => setFormData({ ...formData, express_days: e.target.value })}
                      placeholder="1"
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rural_days">Орон нутаг</Label>
                    <Input
                      id="rural_days"
                      type="number"
                      value={formData.rural_days}
                      onChange={(e) => setFormData({ ...formData, rural_days: e.target.value })}
                      placeholder="5"
                      min="1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Идэвхтэй</Label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Болих
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingZone ? "Хадгалах" : "Нэмэх"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Zones table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Хүргэлтийн бүс
            {zones && <Badge variant="secondary">{zones.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : zones && zones.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Бүс</TableHead>
                    <TableHead>Төрөл</TableHead>
                    <TableHead className="text-right">Стандарт</TableHead>
                    <TableHead className="text-right">Түргэн</TableHead>
                    <TableHead className="text-right">Орон нутаг</TableHead>
                    <TableHead className="text-center">Төлөв</TableHead>
                    <TableHead className="text-right">Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.map((zone) => (
                    <TableRow key={zone.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{zone.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getZoneTypeBadge(zone.zone_type)}</TableCell>
                      <TableCell className="text-right">
                        <div>{formatCurrency(zone.standard_price)}</div>
                        <div className="text-xs text-muted-foreground">
                          {zone.standard_days} өдөр
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {zone.express_price ? (
                          <>
                            <div>{formatCurrency(zone.express_price)}</div>
                            <div className="text-xs text-muted-foreground">
                              {zone.express_days} өдөр
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {zone.rural_price ? (
                          <>
                            <div>{formatCurrency(zone.rural_price)}</div>
                            <div className="text-xs text-muted-foreground">
                              {zone.rural_days} өдөр
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {zone.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Идэвхтэй</Badge>
                        ) : (
                          <Badge variant="secondary">Идэвхгүй</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(zone)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(zone.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Хүргэлтийн бүс олдсонгүй</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
