import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Camera, ImagePlus, Link2, Loader2, ChevronDown, Globe, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProviderLogos, getProviderLogo } from "@/hooks/useProviderLogos";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface SearchProvider {
  value: string;
  label: string;
  icon: React.ElementType;
}

const DEFAULT_PROVIDERS: SearchProvider[] = [
  { value: "", label: "Бүгд", icon: Globe },
  { value: "Taobao", label: "Taobao", icon: Globe },
  { value: "Poizon", label: "Poizon", icon: Globe },
  { value: "local", label: "Бэлэн бараа", icon: Package },
];

function isProductUrl(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return ["taobao.com", "tmall.com", "1688.com", "poizon.com", "dewu.com", "detail.tmall.com"]
      .some((d) => url.hostname.includes(d));
  } catch {
    return /^https?:\/\//i.test(text.trim());
  }
}

function extractItemIdFromUrl(url: string): string | null {
  const idMatch = url.match(/[?&]id=(\d+)/);
  if (idMatch) return idMatch[1];
  const pathMatch = url.match(/\/item\/(\d+)/);
  if (pathMatch) return pathMatch[1];
  const poizonMatch = url.match(/\/(\d{8,})/);
  if (poizonMatch) return poizonMatch[1];
  return null;
}

interface HeaderSearchProps {
  className?: string;
  autoFocus?: boolean;
  onSearchComplete?: () => void;
}

export default function HeaderSearch({ className, autoFocus, onSearchComplete }: HeaderSearchProps) {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [provider, setProvider] = useState<string | null>(null); // null = not yet loaded
  const [imagePopoverOpen, setImagePopoverOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: stripItems } = useProviderLogos();

  // Fetch default provider from admin settings
  const { data: adminDefault } = useQuery({
    queryKey: ["admin_settings", "search_default_provider"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "search_default_provider")
        .maybeSingle();
      if (!data?.setting_value) return "Taobao";
      // setting_value is jsonb — could be a JSON string with quotes
      const val = data.setting_value;
      const str = typeof val === "string" ? val.replace(/^"|"$/g, "") : String(val);
      return str || "Taobao";
    },
    staleTime: 5 * 60 * 1000,
  });

  // Set provider once admin default loads (only if not yet initialized)
  useEffect(() => {
    if (provider === null && adminDefault != null) {
      setProvider(adminDefault);
    }
  }, [adminDefault, provider]);

  const effectiveProvider = provider ?? "Taobao";

  const providers = DEFAULT_PROVIDERS;
  const selectedProvider = providers.find((p) => p.value === effectiveProvider) || providers[0];
  const SelectedIcon = selectedProvider.icon;
  const selectedLogo = getProviderLogo(stripItems, selectedProvider.value);

  // Detect Cyrillic (Mongolian) text
  const CYRILLIC_RE = /[\u0400-\u04FF]/;

  const translateIfMongolian = useCallback(async (text: string): Promise<string> => {
    if (!CYRILLIC_RE.test(text)) return text;
    try {
      setTranslating(true);
      const { data, error } = await supabase.functions.invoke("translate-search", {
        body: { query: text },
      });
      if (error) throw error;
      return data?.translated || text;
    } catch (err) {
      console.error("Translation failed, using original:", err);
      return text;
    } finally {
      setTranslating(false);
    }
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = searchInput.trim();
    if (!text) return;

    if (isProductUrl(text)) {
      const itemId = extractItemIdFromUrl(text);
      if (itemId) {
        navigate(`/ot/product/${itemId}`);
      } else {
        navigate(`/ot?q=${encodeURIComponent(text)}`);
      }
    } else if (effectiveProvider === "local") {
      navigate(`/shop?q=${encodeURIComponent(text)}`);
    } else {
      // Translate Mongolian to Chinese for OT search
      const translatedQuery = await translateIfMongolian(text);
      const params = new URLSearchParams();
      params.set("q", translatedQuery);
      if (effectiveProvider) params.set("provider", effectiveProvider);
      navigate(`/ot?${params.toString()}`);
    }
    onSearchComplete?.();
  };

  const handleImageSearch = (imageUrl: string) => {
    if (!imageUrl) return;
    navigate(`/ot?imageUrl=${encodeURIComponent(imageUrl)}`);
    setImagePopoverOpen(false);
    setImageUrlInput("");
    onSearchComplete?.();
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      // Try authenticated upload first, fall back to anonymous-friendly path
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || "anon";
      const path = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("image-search")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("image-search")
        .getPublicUrl(path);

      if (urlData?.publicUrl) {
        handleImageSearch(urlData.publicUrl);
      }
    } catch (err) {
      console.error("Image upload failed:", err);
      // Fallback: try URL input instead
      toast.error("Зураг upload хийхэд алдаа гарлаа. Зургийн URL оруулна уу.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <form onSubmit={handleSearch} className="flex items-center gap-0">
        {/* Provider Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 rounded-r-none border-r-0 h-10 gap-1.5 px-2.5 bg-muted/50"
            >
              {selectedLogo ? (
                <img src={selectedLogo} alt="" className="w-4 h-4 object-contain rounded-full" />
              ) : (
                <SelectedIcon className="h-4 w-4" />
              )}
              <span className="text-xs font-medium hidden sm:inline">{selectedProvider.label}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44 bg-popover z-50">
            {providers.map((p) => {
              const Icon = p.icon;
              const logo = getProviderLogo(stripItems, p.value);
              return (
                <DropdownMenuItem
                  key={p.value}
                  onClick={() => setProvider(p.value)}
                  className={cn(
                    "gap-2 cursor-pointer",
                    effectiveProvider === p.value && "bg-accent"
                  )}
                >
                  {logo ? (
                    <img src={logo} alt="" className="w-4 h-4 object-contain rounded-full" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span>{p.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              effectiveProvider === "local"
                ? "Бэлэн бараа хайх..."
                : "Бараа хайх эсвэл линк оруулах..."
            }
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 pr-3 rounded-none border-x-0 h-10 bg-muted/50"
            autoFocus={autoFocus}
          />
        </div>

        {/* Image Search Popover */}
        <Popover open={imagePopoverOpen} onOpenChange={setImagePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 rounded-none border-r-0 h-10 w-10"
              title="Зургаар хайх"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 bg-popover z-50" align="end">
            <p className="text-sm font-medium mb-2">Зургаар хайх</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md border border-dashed hover:bg-muted/50 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                )}
                {uploading ? "Уншиж байна..." : "Зураг upload хийх"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFile}
              />
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Зургийн URL..."
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    className="h-8 text-xs pl-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (imageUrlInput.trim()) handleImageSearch(imageUrlInput.trim());
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-2.5"
                  disabled={!imageUrlInput.trim()}
                  onClick={() => handleImageSearch(imageUrlInput.trim())}
                >
                  Хайх
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Submit */}
        <Button type="submit" className="shrink-0 rounded-l-none h-10 px-4">
          <Search className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline text-sm">Хайх</span>
        </Button>
      </form>
    </div>
  );
}
