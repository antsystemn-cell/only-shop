import { useState, useMemo } from "react";
import { ChevronDown, Folder, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { searchItems, fetchItemsByIds } from "@/services/otApi";
import { useProviderSafe } from "@/contexts/ProviderContext";
import { useTranslatedTitles } from "@/hooks/useTranslatedTitles";
import { Loader2, Package } from "lucide-react";

type ProviderTab = "Poizon" | "Taobao";

interface OtCat {
  id: string;
  internal_id: string;
  name_mn: string | null;
  name_en: string | null;
  icon_url: string | null;
  provider_type: string | null;
  parent_internal_id: string | null;
  external_id?: string | null;
  item_ids?: string[] | null;
}

const POIZON_ROOT_ID = "otc-1465";
const CAT_FIELDS = "id, internal_id, name_mn, name_en, icon_url, provider_type, parent_internal_id, external_id, item_ids";

export default function MobileCategories() {
  const { apiProvider } = useProviderSafe();
  const [activeTab, setActiveTab] = useState<ProviderTab>("Poizon");
  const [search, setSearch] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedSubCatId, setSelectedSubCatId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch top-level categories for the dropdown
  const { data: categories, isLoading } = useQuery({
    queryKey: ["mobile-categories", activeTab],
    queryFn: async () => {
      let query = supabase
        .from("ot_categories")
        .select(CAT_FIELDS)
        .eq("is_active", true)
        .order("display_order");

      if (activeTab === "Poizon") {
        query = query.eq("parent_internal_id", POIZON_ROOT_ID);
      } else {
        query = query.eq("provider_type", activeTab).is("parent_internal_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as OtCat[];
    },
    staleTime: 1000 * 60 * 30,
  });

  const selectedCategory = categories?.find((c) => c.internal_id === selectedCatId);

  // Fetch subcategories of selected category
  const { data: subcategories } = useQuery({
    queryKey: ["mobile-subcategories", selectedCatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ot_categories")
        .select(CAT_FIELDS)
        .eq("parent_internal_id", selectedCatId!)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as OtCat[];
    },
    enabled: !!selectedCatId,
    staleTime: 1000 * 60 * 30,
  });

  const selectedSubCategory = subcategories?.find((c) => c.internal_id === selectedSubCatId);

  // Fetch sub-subcategories of selected subcategory
  const { data: subSubcategories } = useQuery({
    queryKey: ["mobile-sub-subcategories", selectedSubCatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ot_categories")
        .select(CAT_FIELDS)
        .eq("parent_internal_id", selectedSubCatId!)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as OtCat[];
    },
    enabled: !!selectedSubCatId,
    staleTime: 1000 * 60 * 30,
  });

  // Determine which category to load products for:
  // Priority: selectedSubCategory > selectedCategory > Poizon root
  const productCategory = selectedSubCategory || selectedCategory || (activeTab === "Poizon" ? { internal_id: POIZON_ROOT_ID, external_id: POIZON_ROOT_ID, provider_type: "Poizon", item_ids: null } as OtCat : null);

  // Fetch products for the active product category
  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ["mobile-cat-products", productCategory?.internal_id, productCategory?.external_id, apiProvider],
    queryFn: async () => {
      if (!productCategory) return [];
      if (productCategory.external_id && productCategory.provider_type) {
        const result = await searchItems({
          categoryId: productCategory.internal_id,
          provider: apiProvider || productCategory.provider_type,
          pageSize: 40,
          page: 0,
        });
        return result.items;
      }
      if (productCategory.item_ids?.length) {
        const pageItems = productCategory.item_ids.slice(0, 20);
        return fetchItemsByIds(pageItems);
      }
      return [];
    },
    enabled: !!productCategory && (!!productCategory.external_id || (productCategory.item_ids?.length || 0) > 0),
    staleTime: 1000 * 60 * 10,
  });

  const productTitles = useMemo(() => (products || []).map(p => p.title), [products]);
  const translations = useTranslatedTitles(productTitles);

  const filtered = categories?.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name_mn?.toLowerCase().includes(q) || c.name_en?.toLowerCase().includes(q);
  });

  const tabs: { key: ProviderTab; label: string }[] = [
    { key: "Poizon", label: "Poizon (Dewu)" },
    { key: "Taobao", label: "Taobao" },
  ];

  const hasSubcats = subcategories && subcategories.length > 0;
  const hasSubSubcats = subSubcategories && subSubcategories.length > 0;
  const hasProducts = products && products.length > 0;

  return (
    <div className="pb-6 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b">
        <div className="px-4 pt-4 pb-3">
          <h1 className="text-xl font-bold mb-3">Ангилал</h1>
          {/* Provider tabs */}
          <div className="flex gap-2 mb-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearch("");
                  setSelectedCatId(null);
                  setSelectedSubCatId(null);
                  setDropdownOpen(false);
                }}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category dropdown selector */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-muted text-sm font-medium text-foreground"
            >
              <div className="flex items-center gap-2 truncate">
                {selectedCategory?.icon_url && (
                  <img src={selectedCategory.icon_url} alt="" className="w-5 h-5 object-contain shrink-0" />
                )}
                <span className="truncate">
                  {selectedCategory
                    ? (selectedCategory.name_mn || selectedCategory.name_en || selectedCategory.internal_id)
                    : "Ангилал сонгох..."}
                </span>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", dropdownOpen && "rotate-180")} />
            </button>

            {/* Dropdown list */}
            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-xl shadow-lg max-h-[50vh] overflow-y-auto z-30">
                {/* Search inside dropdown — no autoFocus */}
                <div className="sticky top-0 bg-background p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Ангилал хайх..."
                      className="pl-9 h-9 rounded-lg bg-muted border-0 text-sm"
                    />
                  </div>
                </div>
                {isLoading ? (
                  <div className="p-4 flex justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered && filtered.length > 0 ? (
                  <div className="py-1">
                    {filtered.map((cat) => (
                      <button
                        key={cat.internal_id}
                        onClick={() => {
                          setSelectedCatId(cat.internal_id);
                          setSelectedSubCatId(null);
                          setDropdownOpen(false);
                          setSearch("");
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/70 transition-colors",
                          selectedCatId === cat.internal_id && "bg-primary/10"
                        )}
                      >
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          {cat.icon_url ? (
                            <img src={cat.icon_url} alt="" className="w-5 h-5 object-contain" />
                          ) : (
                            <Folder className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-sm font-medium truncate">
                          {cat.name_mn || cat.name_en || cat.internal_id}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Олдсонгүй
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close dropdown overlay */}
      {dropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => { setDropdownOpen(false); setSearch(""); }} />
      )}

      {/* Content area */}
      <div className="px-3 pt-3">
        {/* Subcategory dropdown if main category selected */}
        {hasSubcats && selectedCatId && (
          <CategoryDropdown
            label={selectedSubCategory
              ? (selectedSubCategory.name_mn || selectedSubCategory.name_en || "Дэд ангилал")
              : "Дэд ангилал сонгох"}
            items={subcategories!}
            selectedId={selectedSubCatId}
            onSelect={(id) => setSelectedSubCatId(id)}
            count={subcategories!.length}
          />
        )}

        {/* Sub-subcategory dropdown if subcategory has children */}
        {hasSubSubcats && selectedSubCatId && (
          <CategoryDropdown
            label="Нарийвчилсан ангилал"
            items={subSubcategories!}
            selectedId={null}
            onSelect={(id) => {
              // Navigate deeper or set as product source
              setSelectedSubCatId(id);
            }}
            count={subSubcategories!.length}
          />
        )}

        {/* Products */}
        {loadingProducts ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : hasProducts ? (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {products!.map((product) => (
              <OtProductCardComponent key={product.id} product={product} translatedTitle={translations[product.title]} />
            ))}
          </div>
        ) : productCategory && !loadingProducts ? (
          <div className="text-center py-12">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Бараа олдсонгүй</p>
          </div>
        ) : !productCategory ? (
          <div className="text-center py-16">
            <Folder className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Дээрээс ангилалаа сонгоно уу</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Reusable category dropdown ──────
function CategoryDropdown({
  label,
  items,
  selectedId,
  onSelect,
  count,
}: {
  label: string;
  items: OtCat[];
  selectedId: string | null;
  onSelect: (internalId: string) => void;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = items.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name_mn?.toLowerCase().includes(q) || c.name_en?.toLowerCase().includes(q);
  });

  return (
    <div className="relative mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-muted/70 text-sm font-medium"
      >
        <span className="truncate">{label} ({count})</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-xl shadow-lg max-h-[40vh] overflow-y-auto z-20">
            <div className="sticky top-0 bg-background p-2 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Хайх..."
                  className="pl-9 h-9 rounded-lg bg-muted border-0 text-sm"
                />
              </div>
            </div>
            <div className="py-1">
              {filtered.map((sub) => (
                <button
                  key={sub.internal_id}
                  onClick={() => {
                    onSelect(sub.internal_id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/70 transition-colors",
                    selectedId === sub.internal_id && "bg-primary/10"
                  )}
                >
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {sub.icon_url ? (
                      <img src={sub.icon_url} alt="" className="w-4 h-4 object-contain" />
                    ) : (
                      <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-sm truncate">
                    {sub.name_mn || sub.name_en || sub.internal_id}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="p-3 text-center text-sm text-muted-foreground">Олдсонгүй</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
