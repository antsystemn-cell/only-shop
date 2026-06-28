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
  { col: "col-span-4 md:col-span-2", row: "row-span-4 md:row-span-2", pad: "p-5 md:p-8" },  // 1. big square
  { col: "col-span-4 md:col-span-2", row: "row-span-4 md:row-span-1", pad: "p-5 md:p-8" },  // 2. wide
  { col: "col-span-4 md:col-span-2", row: "row-span-4 md:row-span-1", pad: "p-5 md:p-8" },  // 3. wide
  { col: "col-span-4 md:col-span-1", row: "row-span-4 md:row-span-1", pad: "p-5 md:p-6" },  // 4. small
  { col: "col-span-4 md:col-span-1", row: "row-span-4 md:row-span-2", pad: "p-5 md:p-6" },  // 5. tall
  { col: "col-span-4 md:col-span-2", row: "row-span-4 md:row-span-2", pad: "p-5 md:p-10" }, // 6. big square
  { col: "col-span-4 md:col-span-1", row: "row-span-4 md:row-span-1", pad: "p-5 md:p-6" },  // 7. small
];

/* ---------- Bento product card ---------- */
function BentoCard({
  product,
  slot,
  tint,
  index,
}: {
  product: Product;
  slot: Slot;
  tint: string;
  index: number;
}) {
  const { addToCart } = useCart();
  const { toast } = useToast();

  return (
    <Link
      to={`/product/${product.slug || product.id}`}
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
      className={`group relative ${slot.col} ${slot.row} ${tint} rounded-sm overflow-hidden flex animate-fade-in transition-all duration-500 will-change-transform hover:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.18)] active:scale-[0.97] active:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)]`}
    >
      {/* Top-left label — clean corner stack */}
      <div className={`absolute top-0 left-0 z-10 ${slot.pad} pr-4`}>
        <h3 className={`font-editorial text-[11px] md:text-[12px] font-medium tracking-[0.01em] ${INK} leading-tight line-clamp-2`}>
          {product.name_mn}
        </h3>
        <p className={`font-editorial text-[11px] md:text-[12px] mt-1.5 ${SOFT_INK} tabular-nums`}>
          {formatPrice(product.price)}
        </p>
      </div>

      {/* Floating PNG-style product image with gentle float loop */}
      <div className="flex-1 flex items-end justify-center min-h-0 p-6 md:p-8 pt-16 md:pt-20">
        {product.images && product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name_mn}
            loading="lazy"
            style={{ mixBlendMode: "multiply", animationDelay: `${index * 120}ms` }}
            className="max-w-[78%] max-h-[78%] w-auto h-auto object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.10)] transition-transform duration-[900ms] ease-out animate-float-soft group-hover:scale-[1.04] group-active:scale-[0.96]"
          />
        ) : null}
      </div>

      {/* Quick add — visible & tappable on mobile */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          addToCart(product);
          toast({ title: "Сагсанд нэмэгдлээ", description: product.name_mn });
        }}
        className="absolute bottom-3 right-3 md:bottom-4 md:right-4 h-8 w-8 md:h-9 md:w-9 rounded-full bg-[#1a1a1a] text-[#faf8f5] flex items-center justify-center shadow-[0_6px_18px_-6px_rgba(0,0,0,0.35)] md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-500 active:scale-90"
        aria-label="Сагсанд хийх"
      >
        <ShoppingCart className="h-3.5 w-3.5 md:h-4 md:w-4" />
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

  const products = (allProducts || []).slice(0, 7);

  return (
    <div className={`${PAPER} ${SOFT_INK} font-editorial min-h-screen animate-fade-in`}>





      {/* ============ BENTO PRODUCT GRID ============ */}
      <section className="px-5 md:px-10 pb-20 md:pb-32">
        <div className="max-w-[1400px] mx-auto">

          {productsLoading ? (
            <div
              className="grid grid-cols-4 gap-2 md:gap-4"
              style={{ gridAutoRows: "var(--bento-row)" }}
            >
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
            <div
              className="grid grid-cols-4 gap-2 md:gap-4 [--bento-row:calc((100vw-40px)/4)] md:[--bento-row:calc((min(100vw,1480px)-80px-48px)/4)]"
              style={{ gridAutoRows: "var(--bento-row)" }}
            >
              {products.map((product, i) => (
                <BentoCard
                  key={product.id}
                  product={product}
                  slot={BENTO_SLOTS[i % BENTO_SLOTS.length]}
                  tint={CARD_TINTS[i % CARD_TINTS.length]}
                  index={i}
                />
              ))}
            </div>
          )}



          <div className="mt-10 md:mt-14 flex justify-center">
            <button
              onClick={() => navigate("/shop")}
              className="text-[10px] md:text-[11px] tracking-eyebrow uppercase hover:opacity-50 transition-opacity inline-flex items-center gap-1 border-b border-[#1a1a1a] pb-1"
            >
              Бүх бараа <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </section>


    </div>
  );
}
