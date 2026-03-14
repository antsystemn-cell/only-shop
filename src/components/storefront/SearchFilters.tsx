import { useState } from "react";
import { X, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SearchProperty } from "@/services/otApi";

const PROVIDERS = [
  { value: "Taobao", label: "Taobao" },
  { value: "Tmall", label: "Tmall" },
  { value: "1688", label: "1688" },
  { value: "Poizon", label: "Poizon / Dewu" },
  { value: "Amazon", label: "Amazon USA" },
];

interface SearchFiltersProps {
  minPrice: string;
  maxPrice: string;
  provider: string;
  imageUrl: string;
  searchProperties: SearchProperty[];
  selectedProperties: Record<string, string>;
  onMinPriceChange: (v: string) => void;
  onMaxPriceChange: (v: string) => void;
  onProviderChange: (v: string) => void;
  onImageSearch: (url: string) => void;
  onPropertyChange: (propertyName: string, valueId: string) => void;
  onClearAll: () => void;
}

export default function SearchFilters({
  minPrice,
  maxPrice,
  provider,
  imageUrl,
  searchProperties,
  selectedProperties,
  onMinPriceChange,
  onMaxPriceChange,
  onProviderChange,
  onImageSearch,
  onPropertyChange,
  onClearAll,
}: SearchFiltersProps) {
  const [imageInput, setImageInput] = useState(imageUrl || "");
  const [uploading, setUploading] = useState(false);

  const hasAnyFilter = minPrice || maxPrice || provider || imageUrl || Object.keys(selectedProperties).length > 0;

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Convert to base64 data URL for OT API image search
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setImageInput(dataUrl);
        onImageSearch(dataUrl);
        setUploading(false);
      };
      reader.onerror = () => setUploading(false);
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Шүүлтүүр</h3>
        {hasAnyFilter && (
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onClearAll}>
            Цэвэрлэх <X className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>

      <Accordion type="multiple" defaultValue={["price", "provider", "image"]} className="space-y-0">
        {/* Price Range */}
        <AccordionItem value="price">
          <AccordionTrigger className="text-sm py-3">Үнийн хүрээ (¥)</AccordionTrigger>
          <AccordionContent>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                placeholder="Мин"
                value={minPrice}
                onChange={(e) => onMinPriceChange(e.target.value)}
                className="h-8 text-xs"
              />
              <span className="text-muted-foreground text-xs">—</span>
              <Input
                type="number"
                placeholder="Макс"
                value={maxPrice}
                onChange={(e) => onMaxPriceChange(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Provider */}
        <AccordionItem value="provider">
          <AccordionTrigger className="text-sm py-3">Нийлүүлэгч</AccordionTrigger>
          <AccordionContent>
            <Select value={provider || "all"} onValueChange={(v) => onProviderChange(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Бүгд" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүгд</SelectItem>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AccordionContent>
        </AccordionItem>

        {/* Image Search */}
        <AccordionItem value="image">
          <AccordionTrigger className="text-sm py-3">Зургаар хайх</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Зургийн URL..."
                  value={imageInput}
                  onChange={(e) => setImageInput(e.target.value)}
                  className="h-8 text-xs flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2"
                  disabled={!imageInput.trim()}
                  onClick={() => onImageSearch(imageInput.trim())}
                >
                  Хайх
                </Button>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors border border-dashed rounded-md p-2 justify-center">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploading ? "Уншиж байна..." : "Зураг оруулах"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} disabled={uploading} />
              </label>
              {imageUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full h-7 text-xs gap-1"
                  onClick={() => {
                    setImageInput("");
                    onImageSearch("");
                  }}
                >
                  Зургийн хайлт арилгах <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Dynamic Search Properties */}
        {searchProperties.map((prop) => (
          <AccordionItem key={prop.propertyName} value={`prop-${prop.propertyName}`}>
            <AccordionTrigger className="text-sm py-3">{prop.propertyName}</AccordionTrigger>
            <AccordionContent>
              <ScrollArea className={prop.values.length > 8 ? "h-48" : undefined}>
                <div className="space-y-1.5">
                  {prop.values.map((v) => (
                    <label key={v.id} className="flex items-center gap-2 cursor-pointer text-xs hover:bg-muted/50 rounded px-1 py-0.5">
                      <Checkbox
                        checked={selectedProperties[prop.propertyName] === v.id}
                        onCheckedChange={(checked) =>
                          onPropertyChange(prop.propertyName, checked ? v.id : "")
                        }
                        className="h-3.5 w-3.5"
                      />
                      <span className="flex-1 truncate">{v.value}</span>
                      {v.itemCount != null && (
                        <span className="text-muted-foreground">({v.itemCount})</span>
                      )}
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
