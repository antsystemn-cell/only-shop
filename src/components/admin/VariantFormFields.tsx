import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ImagePlus,
  X,
  Loader2,
  Palette,
  Ruler,
  Tag,
} from "lucide-react";

export interface VariantFormData {
  id: string;
  name: string;
  size: string;
  color: string;
  color_hex: string;
  dimensions: string;
  weight: string;
  price: string; // Absolute price (not adjustment)
  stock: string;
  sku_suffix: string;
  is_active: boolean;
  images: string[];
}

export const emptyVariantForm: VariantFormData = {
  id: "",
  name: "",
  size: "",
  color: "",
  color_hex: "#000000",
  dimensions: "",
  weight: "",
  price: "",
  stock: "0",
  sku_suffix: "",
  is_active: true,
  images: [],
};

interface VariantFormFieldsProps {
  data: VariantFormData;
  onChange: (data: VariantFormData) => void;
  basePrice?: number;
  showPriceHelp?: boolean;
}

export function VariantFormFields({
  data,
  onChange,
  basePrice,
  showPriceHelp = true,
}: VariantFormFieldsProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newImages: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `variants/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("products")
          .getPublicUrl(fileName);

        newImages.push(urlData.publicUrl);
      }

      onChange({
        ...data,
        images: [...data.images, ...newImages],
      });

      toast({
        title: "Зураг нэмэгдлээ",
        description: `${newImages.length} зураг амжилттай upload хийгдлээ`,
      });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = (index: number) => {
    onChange({
      ...data,
      images: data.images.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      {/* Variant Name */}
      <div className="space-y-2">
        <Label htmlFor="var_name" className="flex items-center gap-1">
          <Tag className="h-3 w-3" />
          Хувилбарын нэр
        </Label>
        <Input
          id="var_name"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="256GB Цагаан"
        />
        <p className="text-xs text-muted-foreground">
          Хэрэглэгчид харагдах хувилбарын нэр
        </p>
      </div>

      {/* Images Section */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1">Хувилбарын зураг</Label>
        <div className="flex flex-wrap gap-2">
          {data.images.map((image, index) => (
            <div key={index} className="relative group">
              <img
                src={image}
                alt={`Variant image ${index + 1}`}
                className="w-16 h-16 object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <label className="w-16 h-16 flex items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
              disabled={isUploading}
            />
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
            )}
          </label>
        </div>
      </div>

      {/* Price & Stock - Most Important */}
      <div className="grid gap-4 grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="var_price" className="font-semibold text-primary">
            Үнэ (₮) *
          </Label>
          <Input
            id="var_price"
            type="number"
            value={data.price}
            onChange={(e) => onChange({ ...data, price: e.target.value })}
            placeholder={basePrice?.toString() || "0"}
            min="0"
            className="border-primary/50"
          />
          {showPriceHelp && (
            <p className="text-xs text-muted-foreground">
              Энэ хувилбарын бүтэн үнэ (суурь үнэ дээр нэмэгдэхгүй)
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="var_stock" className="font-semibold">
            Нөөц *
          </Label>
          <Input
            id="var_stock"
            type="number"
            value={data.stock}
            onChange={(e) => onChange({ ...data, stock: e.target.value })}
            placeholder="0"
            min="0"
          />
        </div>
      </div>

      {/* Size & Dimensions */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="var_size" className="flex items-center gap-1">
            <Ruler className="h-3 w-3" />
            Размер
          </Label>
          <Input
            id="var_size"
            value={data.size}
            onChange={(e) => onChange({ ...data, size: e.target.value })}
            placeholder="S, M, L, XL..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="var_dimensions">Хэмжээ</Label>
          <Input
            id="var_dimensions"
            value={data.dimensions}
            onChange={(e) => onChange({ ...data, dimensions: e.target.value })}
            placeholder="128GB, 256GB..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="var_weight">Жин</Label>
          <Input
            id="var_weight"
            value={data.weight}
            onChange={(e) => onChange({ ...data, weight: e.target.value })}
            placeholder="500г, 1кг..."
          />
        </div>
      </div>

      {/* Color */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="var_color" className="flex items-center gap-1">
            <Palette className="h-3 w-3" />
            Өнгө
          </Label>
          <Input
            id="var_color"
            value={data.color}
            onChange={(e) => onChange({ ...data, color: e.target.value })}
            placeholder="Улаан, Хар..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="var_color_hex">Өнгөний код</Label>
          <div className="flex gap-2">
            <Input
              id="var_color_hex"
              type="color"
              value={data.color_hex}
              onChange={(e) => onChange({ ...data, color_hex: e.target.value })}
              className="w-12 h-10 p-1 cursor-pointer"
            />
            <Input
              value={data.color_hex}
              onChange={(e) => onChange({ ...data, color_hex: e.target.value })}
              placeholder="#000000"
              className="flex-1"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="var_sku_suffix">SKU дагавар</Label>
          <Input
            id="var_sku_suffix"
            value={data.sku_suffix}
            onChange={(e) => onChange({ ...data, sku_suffix: e.target.value })}
            placeholder="-PRO-RED"
          />
        </div>
      </div>

      {/* Active Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="var_is_active"
          checked={data.is_active}
          onCheckedChange={(checked) => onChange({ ...data, is_active: checked })}
        />
        <Label htmlFor="var_is_active">Идэвхтэй</Label>
      </div>
    </div>
  );
}
