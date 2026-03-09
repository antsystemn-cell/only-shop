import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, ShoppingBag, SlidersHorizontal } from "lucide-react";

export default function AmazonShop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const categoryFilter = searchParams.get("category") || "";
  const sortBy = searchParams.get("sort") || "newest";

  const { data: products, isLoading } = useQuery({
    queryKey: ["amazon-storefront-products", categoryFilter, sortBy],
    queryFn: async () => {
      let query = supabase
        .from("amazon_products")
        .select("*, amazon_product_store_settings!inner(*)")
        .eq("amazon_product_store_settings.publish_status", "published")
        .eq("source_status", "active")
        .limit(48);

      if (categoryFilter) {
        query = query.eq("amazon_category_id", categoryFilter);
      }

      if (sortBy === "newest") {
        query = query.order("created_at", { ascending: false });
      } else if (sortBy === "price_asc") {
        query = query.order("source_price", { ascending: true });
      } else if (sortBy === "price_desc") {
        query = query.order("source_price", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["amazon-storefront-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amazon_categories")
        .select("*")
        .eq("is_active", true)
        .eq("is_hidden", false)
        .gt("product_count", 0)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = search
    ? products?.filter((p) => (p.title || "").toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShoppingBag className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Amazon бараанууд</h1>
          <p className="text-sm text-muted-foreground">Amazon-оос импортлогдсон бараанууд</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Бараа хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            const params = new URLSearchParams(searchParams);
            if (v === "all") params.delete("category");
            else params.set("category", v);
            setSearchParams(params);
          }}
        >
          <SelectTrigger className="w-48">
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Ангилал" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх ангилал</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.product_count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sortBy}
          onValueChange={(v) => {
            const params = new URLSearchParams(searchParams);
            params.set("sort", v);
            setSearchParams(params);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Шинэ</SelectItem>
            <SelectItem value="price_asc">Үнэ: Бага → Их</SelectItem>
            <SelectItem value="price_desc">Үнэ: Их → Бага</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : filtered?.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((product) => {
            const settings = product.amazon_product_store_settings?.[0];
            const displayTitle = settings?.local_title_override || product.title;
            const displayPrice = settings?.manual_price_override || product.source_price;
            const slug = settings?.local_slug || product.asin;

            return (
              <Link key={product.id} to={`/amazon/product/${product.asin}`}>
                <Card className="group hover:shadow-lg transition-shadow overflow-hidden h-full">
                  <div className="aspect-square relative overflow-hidden bg-muted">
                    {product.main_image ? (
                      <img
                        src={product.main_image}
                        alt={displayTitle || ""}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    <Badge className="absolute top-2 left-2 bg-orange-500 text-white text-[10px]">Amazon</Badge>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="text-sm font-medium line-clamp-2 mb-1">{displayTitle}</h3>
                    {product.brand && (
                      <p className="text-xs text-muted-foreground mb-1">{product.brand}</p>
                    )}
                    {displayPrice && (
                      <p className="text-sm font-bold text-primary">
                        {Number(displayPrice).toLocaleString()}
                        <span className="text-xs font-normal ml-0.5">{product.source_currency || "USD"}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingBag className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg">Бараа олдсонгүй</p>
        </div>
      )}
    </div>
  );
}
