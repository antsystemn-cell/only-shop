import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import {
  Search,
  Loader2,
  Grid2X2,
  Grid3X3,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { OtCategoryCardComponent } from "@/components/storefront/OtCategoryCard";
import { searchItems, fetchRootCategories } from "@/services/otApi";
import { Skeleton } from "@/components/ui/skeleton";

export default function OtShop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [gridCols, setGridCols] = useState<3 | 4>(4);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");

  const query = searchParams.get("q") || "";
  const categoryId = searchParams.get("category") || "";
  const page = parseInt(searchParams.get("page") || "0");
  const orderBy = searchParams.get("sort") || "";
  const pageSize = 40;

  // Fetch root categories for browsing
  const { data: rootCategories, isLoading: loadingCategories } = useQuery({
    queryKey: ["ot-root-categories"],
    queryFn: fetchRootCategories,
    staleTime: 1000 * 60 * 30, // 30 min cache
  });

  // Search/browse products
  const { data: searchResult, isLoading: loadingSearch } = useQuery({
    queryKey: ["ot-search", query, categoryId, page, orderBy],
    queryFn: () =>
      searchItems({
        query: query || undefined,
        categoryId: categoryId || undefined,
        page,
        pageSize,
        orderBy: orderBy || undefined,
      }),
    enabled: !!(query || categoryId),
    staleTime: 1000 * 60 * 5,
  });

  const totalPages = searchResult
    ? Math.ceil(searchResult.totalCount / pageSize)
    : 0;

  const updateParam = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    if (key !== "page") newParams.delete("page");
    setSearchParams(newParams);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      updateParam("q", searchInput.trim());
    }
  };

  const showBrowse = !query && !categoryId;

  return (
    <div className="container py-6 md:py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Маркетплэйс</h1>
        <p className="text-muted-foreground mt-1">
          Олон мянган бараанаас хайж олоорой
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Бараа хайх... (англиар бичнэ үү)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit">Хайх</Button>
      </form>

      {/* Breadcrumbs */}
      {searchResult?.breadcrumbs && searchResult.breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4 flex-wrap">
          <Link to="/ot" className="hover:text-foreground">
            Маркетплэйс
          </Link>
          {searchResult.breadcrumbs.map((bc) => (
            <span key={bc.id} className="flex items-center gap-1">
              <span>/</span>
              <button
                onClick={() => updateParam("category", bc.id)}
                className="hover:text-foreground"
              >
                {bc.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Active filters */}
      {(query || categoryId) && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {query && (
            <Button
              variant="secondary"
              size="sm"
              className="gap-1"
              onClick={() => {
                updateParam("q", null);
                setSearchInput("");
              }}
            >
              "{query}" <X className="h-3 w-3" />
            </Button>
          )}
          {categoryId && (
            <Button
              variant="secondary"
              size="sm"
              className="gap-1"
              onClick={() => updateParam("category", null)}
            >
              Ангилал <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {/* Browse mode: show root categories */}
      {showBrowse && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Ангилалууд</h2>
          {loadingCategories ? (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <Skeleton className="w-20 h-20 rounded-2xl" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : rootCategories && rootCategories.length > 0 ? (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {rootCategories.map((cat) => (
                <OtCategoryCardComponent key={cat.id} category={cat} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-12">
              Ангилал ачаалж чадсангүй. Дахин оролдоно уу.
            </p>
          )}
        </div>
      )}

      {/* Search results */}
      {!showBrowse && (
        <div>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {loadingSearch ? "Хайж байна..." : `${searchResult?.totalCount || 0} бараа олдлоо`}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={orderBy || "default"}
                onValueChange={(v) => updateParam("sort", v === "default" ? null : v)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Эрэмбэлэх" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Хамааралтай</SelectItem>
                  <SelectItem value="Price:Asc">Үнэ: Багаас</SelectItem>
                  <SelectItem value="Price:Desc">Үнэ: Ихээс</SelectItem>
                  <SelectItem value="Volume:Desc">Борлуулалт</SelectItem>
                </SelectContent>
              </Select>
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
            </div>
          </div>

          {/* Subcategories */}
          {searchResult?.subCategories && searchResult.subCategories.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3">Дэд ангилалууд</h3>
              <div className="flex flex-wrap gap-2">
                {searchResult.subCategories.slice(0, 12).map((cat) => (
                  <Button
                    key={cat.id}
                    variant="outline"
                    size="sm"
                    onClick={() => updateParam("category", cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Products Grid */}
          {loadingSearch ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card overflow-hidden">
                  <Skeleton className="aspect-square" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : searchResult?.items && searchResult.items.length > 0 ? (
            <div
              className={`grid gap-3 md:gap-4 ${
                gridCols === 3
                  ? "grid-cols-2 md:grid-cols-3"
                  : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              }`}
            >
              {searchResult.items.map((product) => (
                <OtProductCardComponent key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-lg text-muted-foreground">Бараа олдсонгүй</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 0}
                onClick={() => updateParam("page", String(page - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={page >= totalPages - 1}
                onClick={() => updateParam("page", String(page + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
