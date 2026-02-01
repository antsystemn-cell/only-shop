import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Filter, Grid3X3, Grid2X2, Loader2, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/storefront/ProductCard";

type SortOption = "newest" | "price-asc" | "price-desc" | "popular";

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [gridCols, setGridCols] = useState<3 | 4>(4);
  
  const categoryFilter = searchParams.get("category");
  const brandFilter = searchParams.get("brand");
  const sortBy = (searchParams.get("sort") as SortOption) || "newest";
  const searchQuery = searchParams.get("q") || "";
  const featuredOnly = searchParams.get("featured") === "true";

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["all-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      return data;
    },
  });

  // Fetch unique brands
  const { data: brands } = useQuery({
    queryKey: ["all-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("brand")
        .eq("is_active", true)
        .not("brand", "is", null);

      if (error) throw error;
      // Get unique brands
      const uniqueBrands = [...new Set(data.map(p => p.brand).filter(Boolean))];
      return uniqueBrands.sort() as string[];
    },
  });

  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ["shop-products", categoryFilter, brandFilter, sortBy, searchQuery, featuredOnly],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .eq("is_active", true);

      // Category filter
      if (categoryFilter) {
        query = query.eq("category_id", categoryFilter);
      }

      // Brand filter
      if (brandFilter) {
        query = query.eq("brand", brandFilter);
      }

      // Featured filter
      if (featuredOnly) {
        query = query.eq("is_featured", true);
      }

      // Search
      if (searchQuery) {
        query = query.or(`name_mn.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%,brand.ilike.%${searchQuery}%`);
      }

      // Sort
      switch (sortBy) {
        case "price-asc":
          query = query.order("price", { ascending: true });
          break;
        case "price-desc":
          query = query.order("price", { ascending: false });
          break;
        case "popular":
          query = query.order("review_count", { ascending: false, nullsFirst: false });
          break;
        default:
          query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
  });

  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const hasFilters = categoryFilter || brandFilter || featuredOnly || searchQuery;

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="font-semibold mb-3">Ангилал</h3>
        <div className="space-y-2">
          {categories?.map((category) => (
            <div key={category.id} className="flex items-center gap-2">
              <Checkbox
                id={category.id}
                checked={categoryFilter === category.id}
                onCheckedChange={(checked) =>
                  updateFilter("category", checked ? category.id : null)
                }
              />
              <Label htmlFor={category.id} className="text-sm cursor-pointer">
                {category.name_mn}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Brands */}
      {brands && brands.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Брэнд</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {brands.map((brand) => (
              <div key={brand} className="flex items-center gap-2">
                <Checkbox
                  id={`brand-${brand}`}
                  checked={brandFilter === brand}
                  onCheckedChange={(checked) =>
                    updateFilter("brand", checked ? brand : null)
                  }
                />
                <Label htmlFor={`brand-${brand}`} className="text-sm cursor-pointer">
                  {brand}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Featured */}
      <div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="featured"
            checked={featuredOnly}
            onCheckedChange={(checked) =>
              updateFilter("featured", checked ? "true" : null)
            }
          />
          <Label htmlFor="featured" className="text-sm cursor-pointer">
            Зөвхөн онцлох бараа
          </Label>
        </div>
      </div>

      {/* Clear */}
      {hasFilters && (
        <Button variant="outline" className="w-full" onClick={clearFilters}>
          Шүүлтүүр цэвэрлэх
        </Button>
      )}
    </div>
  );

  return (
    <div className="container py-8 animate-fade-in">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Дэлгүүр</h1>
        <p className="text-muted-foreground mt-1">
          Бүх бараануудыг харах
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Filters - Desktop */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 space-y-6">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Шүүлтүүр
            </h2>
            <FilterContent />
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Бараа хайх..."
                value={searchQuery}
                onChange={(e) => updateFilter("q", e.target.value || null)}
              />
            </div>

            {/* Sort */}
            <Select
              value={sortBy}
              onValueChange={(value) => updateFilter("sort", value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Эрэмбэлэх" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Шинэ</SelectItem>
                <SelectItem value="price-asc">Үнэ: Багаас их</SelectItem>
                <SelectItem value="price-desc">Үнэ: Ихээс бага</SelectItem>
                <SelectItem value="popular">Түгээмэл</SelectItem>
              </SelectContent>
            </Select>

            {/* Grid Toggle */}
            <div className="hidden md:flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant={gridCols === 3 ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setGridCols(3)}
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button
                variant={gridCols === 4 ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setGridCols(4)}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>

            {/* Mobile Filter Button */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Шүүлтүүр
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Шүүлтүүр</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FilterContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Active Filters */}
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-sm text-muted-foreground">Шүүлтүүр:</span>
              {categoryFilter && categories && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={() => updateFilter("category", null)}
                >
                  {categories.find((c) => c.id === categoryFilter)?.name_mn}
                  <X className="h-3 w-3" />
                </Button>
              )}
              {brandFilter && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={() => updateFilter("brand", null)}
                >
                  {brandFilter}
                  <X className="h-3 w-3" />
                </Button>
              )}
              {featuredOnly && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={() => updateFilter("featured", null)}
                >
                  Онцлох
                  <X className="h-3 w-3" />
                </Button>
              )}
              {searchQuery && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={() => updateFilter("q", null)}
                >
                  "{searchQuery}"
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}

          {/* Products Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : products && products.length > 0 ? (
            <div
              className={`grid gap-4 md:gap-6 ${
                gridCols === 3
                  ? "grid-cols-2 md:grid-cols-3"
                  : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              }`}
            >
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-lg text-muted-foreground">
                Бараа олдсонгүй
              </p>
              {hasFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Шүүлтүүр цэвэрлэх
                </Button>
              )}
            </div>
          )}

          {/* Results Count */}
          {products && products.length > 0 && (
            <p className="text-sm text-muted-foreground mt-6 text-center">
              Нийт {products.length} бараа
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
