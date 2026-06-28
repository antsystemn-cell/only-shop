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

const PAPER = "bg-[#faf8f5]";
const INK = "text-[#1a1a1a]";
const SOFT_INK = "text-[#4a4a4a]";

/* Soft pastel card backgrounds — cycled */
const CARD_TINTS = [
  "bg-[#f1ede6]", // warm cream
  "bg-[#e6ecef]", // soft blue-grey
  "bg-[#f4e4e1]", // blush
  "bg-[#ece7df]", // sand
  "bg-[#e8ebe4]", // sage cream
  "bg-[#f0e6e1]", // peach
];

function formatPrice(price: number) {
  return "₮" + new Intl.NumberFormat("mn-MN").format(price);
}

/* Bento layout slots — cycles every 7 products to match the reference grid */
type Slot = { col: string; row: string; pad: string };
const BENTO_SLOTS: Slot[] = [
  { col: "md:col-span-1", row: "md:row-span-2", pad: "p-6 md:p-8" },  // tall small
  { col: "md:col-span-2", row: "md:row-span-1", pad: "p-6 md:p-8" },  // wide
  { col: "md:col-span-2", row: "md:row-span-1", pad: "p-6 md:p-8" },  // wide
  { col: "md:col-span-1", row: "md:row-span-1", pad: "p-5 md:p-6" },  // small
  { col: "md:col-span-1", row: "md:row-span-2", pad: "p-5 md:p-6" },  // tall
  { col: "md:col-span-2", row: "md:row-span-2", pad: "p-8 md:p-10" }, // big square
  { col: "md:col-span-1", row: "md:row-span-1", pad: "p-5 md:p-6" },  // small
];

/* ---------- Bento product card ---------- */
function BentoCard({
  product,
  slot,
  tint,
}: {
  product: Product;
  slot: Slot;
  tint: string;
}) {
  const { addToCart } = useCart();
  const { toast } = useToast();

  return (
    <Link
      to={`/product/${product.slug || product.id}`}
      className={`group relative ${slot.col} ${slot.row} ${tint} ${slot.pad} rounded-sm overflow-hidden flex flex-col min-h-[220px] md:min-h-[260px] transition-shadow duration-500 hover:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.18)]`}
    >
      {/* Top-left label */}
      <div className="relative z-10">
        <h3 className={`font-editorial text-[13px] md:text-sm font-medium ${INK} leading-snug line-clamp-2`}>
          {product.name_mn}
        </h3>
        <p className={`font-editorial text-[12px] md:text-[13px] mt-1 ${SOFT_INK}`}>
          {formatPrice(product.price)}
        </p>
      </div>

      {/* Centered floating product image */}
      <div className="flex-1 flex items-center justify-center min-h-0 mt-3">
        {product.images && product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name_mn}
            loading="lazy"
            className="max-w-[85%] max-h-[85%] w-auto h-auto object-contain transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
          />
        ) : null}
      </div>

      {/* Quick add */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          addToCart(product);
          toast({ title: "Сагсанд нэмэгдлээ", description: product.name_mn });
        }}
        className="absolute bottom-4 right-4 h-9 w-9 rounded-full bg-[#1a1a1a] text-[#faf8f5] flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500"
        aria-label="Сагсанд хийх"
      >
        <ShoppingCart className="h-4 w-4" />
      </button>
    </Link>
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

  return (
    <div className={`${PAPER} ${SOFT_INK} font-editorial min-h-screen animate-fade-in`}>

      {/* ============ HERO ============ */}
      <section className="px-5 md:px-12 lg:px-20 pt-12 md:pt-20 pb-14 md:pb-20">
        <div className="max-w-[1400px] mx-auto animate-editorial-rise">
          <span className={`block text-[10px] md:text-[11px] tracking-eyebrow uppercase ${SOFT_INK}/70 mb-6 md:mb-10`}>
            Only.mn — Сонгомол барааны дэлгүүр
          </span>
          <h1 className={`font-display ${INK} leading-[0.9] text-[clamp(2.75rem,9vw,7rem)]`}>
            Сонгомол бараа,
            <br />
            <span className="italic md:ml-[10vw]">нарийн амт</span>
          </h1>
          <div className="mt-10 md:mt-14 flex flex-col md:flex-row md:justify-end gap-8">
            <p className={`max-w-md text-base md:text-lg leading-relaxed ${SOFT_INK}/85 font-light`}>
              Бид таны өдөр тутмын хэрэглээнд зориулж хамгийн нарийн хийцтэй,
              чанартай бүтээгдэхүүнүүдийг нэг дор цуглууллаа.
            </p>
          </div>
        </div>
      </section>




      {/* ============ BENTO PRODUCT GRID ============ */}
      <section className="px-5 md:px-12 lg:px-20 pb-20 md:pb-32">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-baseline justify-between mb-8 md:mb-12 border-b border-[#ece8e0] pb-5">
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
            <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[180px] md:auto-rows-[200px] gap-4 md:gap-6">
              {Array.from({ length: 7 }).map((_, i) => {
                const slot = BENTO_SLOTS[i % BENTO_SLOTS.length];
                return (
                  <Skeleton
                    key={i}
                    className={`${slot.col} ${slot.row} ${CARD_TINTS[i % CARD_TINTS.length]} rounded-sm`}
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[180px] md:auto-rows-[220px] gap-4 md:gap-6">
              {products.map((product, i) => (
                <BentoCard
                  key={product.id}
                  product={product}
                  slot={BENTO_SLOTS[i % BENTO_SLOTS.length]}
                  tint={CARD_TINTS[i % CARD_TINTS.length]}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============ EDITORIAL BAND ============ */}
      <section className="px-5 md:px-12 lg:px-20 pb-20 md:pb-32">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 items-center">
          <div className="md:col-span-5">
            <span className="text-[10px] md:text-[11px] tracking-eyebrow uppercase opacity-60 block mb-6">
              Бидний тухай
            </span>
            <h2 className={`font-display italic ${INK} text-4xl md:text-5xl leading-[0.95] mb-8`}>
              Өдөр бүрийн чанартай амьдрал
            </h2>
            <p className={`${SOFT_INK}/85 text-base md:text-lg leading-relaxed font-light max-w-md mb-10`}>
              Бид өдөр тутмын хэрэглээг урлаг болгон хувиргахыг зорьдог.
              Хийц, чанар, мэдрэмж — гурван үндсэн зарчмаар сонголтоо хийдэг.
            </p>
            <Link
              to="/shop"
              className="inline-flex items-center gap-3 border-b border-[#1a1a1a] pb-1 text-[11px] tracking-eyebrow uppercase hover:opacity-50 transition-opacity"
            >
              Дэлгүүр үзэх <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="md:col-span-7 md:pl-16">
            <div className={`aspect-[4/3] ${CARD_TINTS[0]} rounded-sm overflow-hidden flex items-center justify-center p-10`}>
              {products[0]?.images?.[0] && (
                <img
                  src={products[0].images[0]}
                  alt=""
                  className="max-w-[80%] max-h-[80%] object-contain"
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
