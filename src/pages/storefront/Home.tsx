import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import HeaderSearch from "@/components/storefront/HeaderSearch";
import { useIsMobile } from "@/hooks/use-mobile";
import { ShoppingCart, ArrowUpRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

const PAPER = "bg-[#f5f3ee]";
const SURFACE = "bg-[#e8e4dd]";
const INK = "text-[#0d0d0d]";
const SOFT_INK = "text-[#2d2d2d]";

function formatPrice(price: number) {
  return "₮" + new Intl.NumberFormat("mn-MN").format(price);
}

/* ---------- Editorial product tile ---------- */
function EditorialTile({
  product,
  aspect = "aspect-[4/5]",
  size = "md",
  eyebrow,
}: {
  product: Product;
  aspect?: string;
  size?: "sm" | "md" | "lg";
  eyebrow?: string;
}) {
  const { addToCart } = useCart();
  const { toast } = useToast();

  const titleSize =
    size === "lg" ? "text-2xl md:text-3xl" : size === "sm" ? "text-base md:text-lg" : "text-lg md:text-xl";
  const priceSize = size === "lg" ? "text-lg md:text-xl" : "text-sm md:text-base";

  return (
    <Link to={`/product/${product.slug || product.id}`} className="group block">
      <div className={`relative ${aspect} ${SURFACE} overflow-hidden`}>
        {product.images && product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name_mn}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full" />
        )}
        {eyebrow && (
          <span className="absolute top-4 left-4 bg-[#0d0d0d] text-[#f5f3ee] px-2.5 py-1 text-[10px] tracking-eyebrow uppercase">
            {eyebrow}
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addToCart(product);
            toast({ title: "Сагсанд нэмэгдлээ", description: product.name_mn });
          }}
          className="absolute bottom-4 right-4 h-10 w-10 rounded-full bg-[#0d0d0d] text-[#f5f3ee] flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500"
          aria-label="Сагсанд хийх"
        >
          <ShoppingCart className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 md:mt-5 flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h3 className={`font-display italic ${titleSize} ${INK} leading-tight line-clamp-2`}>
            {product.name_mn}
          </h3>
        </div>
        <span className={`font-editorial ${priceSize} ${INK} whitespace-nowrap pt-1`}>
          {formatPrice(product.price)}
        </span>
      </div>
    </Link>
  );
}

/* ---------- Masonry skeleton ---------- */
function MasonrySkeleton() {
  const blocks = [
    "md:col-span-8 aspect-[16/10]",
    "md:col-span-4 md:mt-32 aspect-[3/4]",
    "md:col-span-4 md:-mt-24 aspect-square",
    "md:col-span-8 aspect-[21/9]",
    "md:col-span-5 aspect-[4/5]",
    "md:col-span-7 md:mt-24 aspect-[4/3]",
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-14">
      {blocks.map((cls, i) => (
        <div key={i} className={cls.split(" ").filter(c => c.startsWith("md:col") || c.startsWith("md:mt") || c.startsWith("md:-mt")).join(" ")}>
          <Skeleton className={`w-full ${cls.split(" ").find(c => c.startsWith("aspect-"))} rounded-none ${SURFACE}`} />
          <div className="mt-5 flex justify-between gap-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Page ---------- */
export default function Home() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const { data: allProducts, isLoading: productsLoading } = useQuery({
    queryKey: ["all-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Product[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: categories } = useQuery({
    queryKey: ["home-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order")
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const products = allProducts || [];

  // Build an asymmetric layout pattern that cycles every 6 products
  const layoutPattern: { col: string; offset: string; aspect: string; size: "sm" | "md" | "lg" }[] = [
    { col: "md:col-span-8", offset: "", aspect: "aspect-[16/10]", size: "lg" },
    { col: "md:col-span-4", offset: "md:mt-32", aspect: "aspect-[3/4]", size: "md" },
    { col: "md:col-span-4", offset: "md:-mt-24", aspect: "aspect-square", size: "md" },
    { col: "md:col-span-8", offset: "", aspect: "aspect-[21/9]", size: "lg" },
    { col: "md:col-span-5", offset: "", aspect: "aspect-[4/5]", size: "md" },
    { col: "md:col-span-7", offset: "md:mt-24", aspect: "aspect-[4/3]", size: "md" },
  ];

  return (
    <div className={`${PAPER} ${SOFT_INK} font-editorial min-h-screen animate-fade-in`}>
      {isMobile && (
        <div className={`sticky top-0 z-30 ${PAPER} px-4 pt-3 pb-3 border-b border-[#e8e4dd]`}>
          <HeaderSearch />
        </div>
      )}

      {/* ============ HERO ============ */}
      <section className="px-5 md:px-12 lg:px-20 pt-12 md:pt-24 pb-20 md:pb-32">
        <div className="max-w-[1400px] mx-auto animate-editorial-rise">
          <span className={`block text-[10px] md:text-[11px] tracking-eyebrow uppercase ${SOFT_INK}/60 mb-6 md:mb-10`}>
            Only.mn — Сонгомол барааны дэлгүүр
          </span>
          <h1 className={`font-display ${INK} leading-[0.88] text-[clamp(3rem,11vw,9rem)]`}>
            Сонгомол бараа,
            <br />
            <span className="italic md:ml-[12vw]">нарийн амт</span>
          </h1>
          <div className="mt-12 md:mt-16 flex flex-col md:flex-row md:justify-end gap-8">
            <p className={`max-w-md text-base md:text-lg leading-relaxed ${SOFT_INK}/80 font-light`}>
              Бид таны өдөр тутмын хэрэглээнд зориулж хамгийн нарийн хийцтэй,
              чанартай бүтээгдэхүүнүүдийг нэг дор цуглууллаа.
            </p>
          </div>
        </div>
      </section>

      {/* ============ CATEGORY STRIP ============ */}
      {categories && categories.length > 0 && (
        <section className="px-5 md:px-12 lg:px-20 pb-20 md:pb-28">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex items-baseline justify-between mb-8 md:mb-12 border-b border-[#e8e4dd] pb-6">
              <span className="text-[10px] md:text-[11px] tracking-eyebrow uppercase opacity-60">
                Ангилал
              </span>
              <Link
                to="/categories"
                className="text-[10px] md:text-[11px] tracking-eyebrow uppercase hover:opacity-50 transition-opacity inline-flex items-center gap-1"
              >
                Бүгдийг үзэх <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-8 md:gap-x-14 gap-y-4">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/shop?category=${c.id}`}
                  className={`font-display italic text-2xl md:text-4xl ${INK} hover:opacity-50 transition-opacity`}
                >
                  {c.name_mn}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ ASYMMETRIC MASONRY ============ */}
      <section className="px-5 md:px-12 lg:px-20 pb-24 md:pb-40">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-baseline justify-between mb-10 md:mb-16 border-b border-[#e8e4dd] pb-6">
            <span className="text-[10px] md:text-[11px] tracking-eyebrow uppercase opacity-60">
              Цуглуулга
            </span>
            <button
              onClick={() => navigate("/shop")}
              className="text-[10px] md:text-[11px] tracking-eyebrow uppercase hover:opacity-50 transition-opacity inline-flex items-center gap-1"
            >
              Бүх бараа <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          {productsLoading ? (
            <MasonrySkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-14 lg:gap-16">
              {products.map((product, i) => {
                const slot = layoutPattern[i % layoutPattern.length];
                const isFeatured = i % 6 === 0;
                return (
                  <div key={product.id} className={`${slot.col} ${slot.offset}`}>
                    <EditorialTile
                      product={product}
                      aspect={slot.aspect}
                      size={slot.size}
                      eyebrow={isFeatured ? "Онцлох" : undefined}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ============ EDITORIAL BAND ============ */}
      <section className="px-5 md:px-12 lg:px-20 pb-24 md:pb-40">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 items-center">
          <div className="md:col-span-5">
            <span className="text-[10px] md:text-[11px] tracking-eyebrow uppercase opacity-60 block mb-6">
              Бидний тухай
            </span>
            <h2 className={`font-display italic ${INK} text-4xl md:text-6xl leading-[0.95] mb-8`}>
              Өдөр бүрийн чанартай амьдрал
            </h2>
            <p className={`${SOFT_INK}/80 text-base md:text-lg leading-relaxed font-light max-w-md mb-10`}>
              Бид өдөр тутмын хэрэглээг урлаг болгон хувиргахыг зорьдог.
              Хийц, чанар, мэдрэмж — гурван үндсэн зарчмаар сонголтоо хийдэг.
            </p>
            <Link
              to="/shop"
              className="inline-flex items-center gap-3 border-b border-[#0d0d0d] pb-1 text-[11px] tracking-eyebrow uppercase hover:opacity-50 transition-opacity"
            >
              Дэлгүүр үзэх <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="md:col-span-7 md:pl-16">
            <div className={`aspect-[4/3] ${SURFACE} overflow-hidden`}>
              {products[0]?.images?.[0] && (
                <img
                  src={products[0].images[0]}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
