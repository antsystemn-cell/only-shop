import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, GripVertical, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Brand = Tables<"brands">;

interface BrandFormData {
  name: string;
  logo_url: string;
  is_active: boolean;
  display_order: number;
}

const defaultFormData: BrandFormData = {
  name: "",
  logo_url: "",
  is_active: true,
  display_order: 0,
};

export default function Brands() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState<BrandFormData>(defaultFormData);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch brands
  const { data: brands, isLoading } = useQuery({
    queryKey: ["admin-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as Brand[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: BrandFormData) => {
      if (editingBrand) {
        const { error } = await supabase
          .from("brands")
          .update(data)
          .eq("id", editingBrand.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("brands").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-brands"] });
      queryClient.invalidateQueries({ queryKey: ["all-brands-home"] });
      toast({
        title: editingBrand ? "Брэнд шинэчлэгдлээ" : "Брэнд нэмэгдлээ",
      });
      handleCloseDialog();
    },
    onError: (error: Error) => {
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
      const { error } = await supabase.from("brands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-brands"] });
      queryClient.invalidateQueries({ queryKey: ["all-brands-home"] });
      toast({ title: "Брэнд устгагдлаа" });
    },
    onError: (error: Error) => {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (brand?: Brand) => {
    if (brand) {
      setEditingBrand(brand);
      setFormData({
        name: brand.name,
        logo_url: brand.logo_url || "",
        is_active: brand.is_active ?? true,
        display_order: brand.display_order ?? 0,
      });
    } else {
      setEditingBrand(null);
      setFormData({
        ...defaultFormData,
        display_order: (brands?.length || 0) + 1,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingBrand(null);
    setFormData(defaultFormData);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("brands")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("brands")
        .getPublicUrl(filePath);

      setFormData({ ...formData, logo_url: urlData.publicUrl });
      toast({ title: "Лого амжилттай оруулсан" });
    } catch (error: any) {
      toast({
        title: "Лого оруулахад алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setFormData({ ...formData, logo_url: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Брэндийн нэр оруулна уу",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Брэндүүд</h1>
          <p className="text-muted-foreground">
            Брэндүүдийн лого болон мэдээллийг удирдах
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Брэнд нэмэх
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Бүх брэндүүд ({brands?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Ачаалж байна...
            </div>
          ) : brands && brands.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-20">Лого</TableHead>
                  <TableHead>Нэр</TableHead>
                  <TableHead className="w-24">Идэвхтэй</TableHead>
                  <TableHead className="w-32 text-right">Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.map((brand, index) => (
                  <TableRow key={brand.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <Avatar className="h-10 w-10 border">
                        {brand.logo_url ? (
                          <AvatarImage
                            src={brand.logo_url}
                            alt={brand.name}
                            className="object-contain p-1"
                          />
                        ) : null}
                        <AvatarFallback className="text-sm font-bold">
                          {brand.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell>
                      <Switch
                        checked={brand.is_active ?? true}
                        onCheckedChange={async (checked) => {
                          await supabase
                            .from("brands")
                            .update({ is_active: checked })
                            .eq("id", brand.id);
                          queryClient.invalidateQueries({
                            queryKey: ["admin-brands"],
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(brand)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Энэ брэндийг устгах уу?")) {
                              deleteMutation.mutate(brand.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Брэнд байхгүй байна. Шинэ брэнд нэмнэ үү.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBrand ? "Брэнд засах" : "Шинэ брэнд нэмэх"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Лого</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-dashed">
                  {formData.logo_url ? (
                    <AvatarImage
                      src={formData.logo_url}
                      alt="Brand logo"
                      className="object-contain p-2"
                    />
                  ) : null}
                  <AvatarFallback className="text-2xl font-bold bg-muted">
                    {formData.name ? formData.name.charAt(0).toUpperCase() : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="logo-upload"
                    className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploading ? "Оруулж байна..." : "Лого оруулах"}
                  </Label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={isUploading}
                  />
                  {formData.logo_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="text-destructive"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Устгах
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Brand Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Брэндийн нэр *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Apple, Samsung..."
              />
            </div>

            {/* Display Order */}
            <div className="space-y-2">
              <Label htmlFor="display_order">Дараалал</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    display_order: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Идэвхтэй</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                Болих
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
