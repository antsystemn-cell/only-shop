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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  FolderTree,
  Loader2,
  GripVertical,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  name_mn: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

export default function Categories() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name_mn: "",
    description: "",
    icon: "",
    display_order: "0",
    is_active: true,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch categories
  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin", "categories", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const categoryData = {
        name: data.name_mn,
        name_mn: data.name_mn,
        description: data.description || null,
        icon: data.icon || null,
        display_order: parseInt(data.display_order) || 0,
        is_active: data.is_active,
      };

      if (data.id) {
        const { error } = await supabase
          .from("categories")
          .update(categoryData)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("categories")
          .insert([categoryData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingCategory ? "Ангилал шинэчлэгдлээ" : "Ангилал нэмэгдлээ",
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
        .from("categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      toast({
        title: "Ангилал устгагдлаа",
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
      name_mn: "",
      description: "",
      icon: "",
      display_order: "0",
      is_active: true,
    });
    setEditingCategory(null);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name_mn: category.name_mn,
      description: category.description || "",
      icon: category.icon || "",
      display_order: category.display_order.toString(),
      is_active: category.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      ...formData,
      id: editingCategory?.id,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Энэ ангилалыг устгахдаа итгэлтэй байна уу? Холбогдсон бараанууд ангилалгүй болно.")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ангилал удирдах</h1>
          <p className="text-muted-foreground mt-1">
            Барааны ангилалуудыг удирдах
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Ангилал нэмэх
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Ангилал засах" : "Шинэ ангилал нэмэх"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name_mn">Ангилалын нэр *</Label>
                <Input
                  id="name_mn"
                  value={formData.name_mn}
                  onChange={(e) => setFormData({ ...formData, name_mn: e.target.value })}
                  placeholder="Электроник"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Тайлбар</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ангилалын тайлбар..."
                  rows={2}
                />
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="icon">Дүрс (Lucide icon)</Label>
                  <Input
                    id="icon"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="Smartphone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display_order">Дараалал</Label>
                  <Input
                    id="display_order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                    placeholder="0"
                    min="0"
                  />
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
                  {editingCategory ? "Хадгалах" : "Нэмэх"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary" />
            Ангилалын жагсаалт
            {categories && <Badge variant="secondary">{categories.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : categories && categories.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Ангилал</TableHead>
                    <TableHead>Тайлбар</TableHead>
                    <TableHead className="text-center">Дараалал</TableHead>
                    <TableHead className="text-center">Төлөв</TableHead>
                    <TableHead className="text-right">Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id} className="hover:bg-muted/50">
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                            <FolderTree className="h-5 w-5 text-secondary" />
                          </div>
                          <div className="font-medium">{category.name_mn}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {category.description || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{category.display_order}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {category.is_active ? (
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
                            onClick={() => handleEdit(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(category.id)}
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
              <FolderTree className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Ангилал олдсонгүй</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
