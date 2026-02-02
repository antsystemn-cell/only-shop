import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  VariantFormFields,
  VariantFormData,
  emptyVariantForm,
} from "./VariantFormFields";
import {
  Plus,
  Pencil,
  Trash2,
  Box,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface MultiVariantCreatorProps {
  variants: VariantFormData[];
  onChange: (variants: VariantFormData[]) => void;
  basePrice?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("mn-MN").format(amount) + "₮";
}

export function MultiVariantCreator({
  variants,
  onChange,
  basePrice,
}: MultiVariantCreatorProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<VariantFormData>({
    ...emptyVariantForm,
    price: basePrice?.toString() || "",
  });

  const handleAdd = () => {
    if (editingId) {
      // Update existing
      onChange(
        variants.map((v) =>
          v.id === editingId ? { ...formData, id: editingId } : v
        )
      );
      setEditingId(null);
    } else {
      // Add new
      const newVariant: VariantFormData = {
        ...formData,
        id: `local-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };
      onChange([...variants, newVariant]);
    }
    resetForm();
  };

  const handleEdit = (variant: VariantFormData) => {
    setFormData(variant);
    setEditingId(variant.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    onChange(variants.filter((v) => v.id !== id));
  };

  const resetForm = () => {
    setFormData({
      ...emptyVariantForm,
      price: basePrice?.toString() || "",
    });
    setShowForm(false);
    setEditingId(null);
  };

  const getVariantDisplayName = (v: VariantFormData) => {
    if (v.name) return v.name;
    const parts = [v.size, v.color, v.dimensions].filter(Boolean);
    return parts.length > 0 ? parts.join(" / ") : "Хувилбар";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Хувилбарууд</h3>
          {variants.length > 0 && (
            <Badge variant="secondary">{variants.length}</Badge>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant={showForm ? "secondary" : "outline"}
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setShowForm(true);
              setEditingId(null);
              setFormData({
                ...emptyVariantForm,
                price: basePrice?.toString() || "",
              });
            }
          }}
        >
          {showForm ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Хаах
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Хувилбар нэмэх
            </>
          )}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <VariantFormFields
            data={formData}
            onChange={setFormData}
            basePrice={basePrice}
          />
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
              Болих
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={!formData.price || parseFloat(formData.price) <= 0}
            >
              {editingId ? "Хадгалах" : "Нэмэх"}
            </Button>
          </div>
        </Card>
      )}

      {/* Variants List */}
      {variants.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-14">Зураг</TableHead>
                <TableHead>Нэр</TableHead>
                <TableHead>Хэмжээ/Өнгө</TableHead>
                <TableHead className="text-right">Үнэ</TableHead>
                <TableHead className="text-center">Нөөц</TableHead>
                <TableHead className="text-center">Төлөв</TableHead>
                <TableHead className="text-right w-24">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <TableRow key={variant.id}>
                  <TableCell>
                    {variant.images && variant.images.length > 0 ? (
                      <img
                        src={variant.images[0]}
                        alt="Variant"
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {getVariantDisplayName(variant)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {variant.color && variant.color_hex && (
                        <div
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: variant.color_hex }}
                        />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {[variant.size, variant.color, variant.dimensions]
                          .filter(Boolean)
                          .join(" / ") || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {variant.price
                      ? formatCurrency(parseFloat(variant.price))
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        parseInt(variant.stock) > 0 ? "secondary" : "destructive"
                      }
                    >
                      {variant.stock}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {variant.is_active ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Идэвхтэй
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Идэвхгүй</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(variant)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(variant.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/30">
          <Box className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Хувилбар байхгүй</p>
          <p className="text-xs mt-1">
            Өнгө, хэмжээ, загвар нэмэхийн тулд дээрх товчийг дарна уу
          </p>
          <p className="text-xs mt-2 text-primary">
            Хувилбар нэмсэн үед суурь үнэ биш хувилбарын үнэ харагдана
          </p>
        </div>
      )}
    </div>
  );
}
