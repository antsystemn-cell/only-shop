import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import HeaderSearch from "@/components/storefront/HeaderSearch";
import { useIsMobile } from "@/hooks/use-mobile";
import { ShoppingCart, ArrowUpRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useRef, useState, useCallback } from "react";
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
  const cardRef = useRef<HTMLAnchorElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const [popShine, setPopShine] = useState(0);

  const firstImage = product.images?.[0];
  const isPng = !!firstImage && /\.png(\?|$)/i.test(firstImage);

  const handleMove = useCallback((e: React.PointerEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;   // 0..1
    const py = (e.clientY - r.top) / r.height;   // 0..1
    const rx = (0.5 - py) * 18;   // tilt X
    const ry = (px - 0.5) * 22;   // tilt Y
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
    // image parallax lift
    if (imgRef.current) {
      const tx = (px - 0.5) * 14;
      const ty = (py - 0.5) * 14;
      imgRef.current.style.setProperty("--tx", `${tx}px`);
      imgRef.current.style.setProperty("--ty", `${ty}px`);
    }
  }, []);

  const handleLeave = useCallback(() => {
    setHovering(false);
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--rx", `0deg`);
    el.style.setProperty("--ry", `0deg`);
    if (imgRef.current) {
      imgRef.current.style.setProperty("--tx", `0px`);
      imgRef.current.style.setProperty("--ty", `0px`);
    }
  }, []);

  return (
    <Link
      ref={cardRef}
      to={`/product/${product.slug || product.id}`}
      onPointerEnter={() => setHovering(true)}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{
        animationDelay: `${index * 80}ms`,
        animationFillMode: "both",
        perspective: "1200px",
        transformStyle: "preserve-3d",
      }}
      className={`group relative ${slot.col} ${slot.row} ${isPng ? tint : "bg-[#1a1a1a]"} rounded-sm overflow-hidden flex animate-fade-in transition-shadow duration-500 will-change-transform hover:shadow-[0_40px_80px_-30px_rgba(0,0,0,0.35)] active:scale-[0.97]`}
    >
      {/* 3D tilting inner stage */}
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{
          transform: "perspective(1200px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Product image — floats in 3D, parallaxes with cursor */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ transformStyle: "preserve-3d" }}>
          {firstImage ? (
            isPng ? (
              <img
                ref={imgRef}
                src={firstImage}
                alt={product.name_mn}
                loading="lazy"
                style={{
                  mixBlendMode: "multiply",
                  animationDelay: `${index * 120}ms`,
                  transform: "translate3d(var(--tx,0px), var(--ty,0px), 60px) scale(var(--imgScale,1))",
                  transformStyle: "preserve-3d",
                  filter: hovering ? "drop-shadow(0 30px 32px rgba(0,0,0,0.28))" : "drop-shadow(0 18px 24px rgba(0,0,0,0.12))",
                }}
                className={`w-full h-full object-contain p-2 md:p-3 transition-[filter,transform] duration-500 ease-out ${hovering ? "" : "animate-float-3d"} group-hover:[--imgScale:1.08] group-active:[--imgScale:0.96]`}
              />
            ) : (
              <img
                ref={imgRef}
                src={firstImage}
                alt={product.name_mn}
                loading="lazy"
                style={{
                  transform: "translate3d(calc(var(--tx,0px)*0.4), calc(var(--ty,0px)*0.4), 30px) scale(var(--imgScale,1.02))",
                  transformStyle: "preserve-3d",
                }}
                className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:[--imgScale:1.1] group-active:[--imgScale:0.98]"
              />
            )
          ) : null}
        </div>

        {/* Cursor-following glare */}
        <div
          ref={glareRef}
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay"
          style={{
            background:
              "radial-gradient(320px circle at var(--gx,50%) var(--gy,50%), rgba(255,255,255,0.55), rgba(255,255,255,0) 60%)",
            transform: "translateZ(40px)",
          }}
        />

        {/* Diagonal shine sweep on hover-enter */}
        <div
          key={popShine}
          className="pointer-events-none absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100"
          style={{ transform: "translateZ(30px)" }}
        >
          <div className="absolute top-0 -left-1/3 h-full w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shine-sweep" />
        </div>

        {/* Bottom gradient + label */}
        <div className={`absolute bottom-0 left-0 right-0 z-10 px-3 md:px-4 pt-8 pb-3 md:pb-4 pointer-events-none ${isPng ? "bg-gradient-to-t from-black/15 via-black/5 to-transparent" : "bg-gradient-to-t from-black/75 via-black/40 to-transparent"}`}
          style={{ transform: "translateZ(20px)" }}
        >
          <h3 className={`font-editorial text-[11px] md:text-[12px] font-medium tracking-[0.01em] leading-tight line-clamp-1 ${isPng ? INK : "text-white"}`}>
            {product.name_mn}
          </h3>
          <p className={`font-editorial text-[11px] md:text-[12px] mt-0.5 tabular-nums ${isPng ? SOFT_INK : "text-white/85"}`}>
            {formatPrice(product.price)}
          </p>
        </div>
      </div>

      {/* Quick add — sits above the 3D stage */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPopShine((p) => p + 1);
          addToCart(product);
          toast({ title: "Сагсанд нэмэгдлээ", description: product.name_mn });
        }}
        className="absolute top-3 right-3 md:top-4 md:right-4 z-20 h-8 w-8 md:h-9 md:w-9 rounded-full bg-[#1a1a1a] text-[#faf8f5] flex items-center justify-center shadow-[0_6px_18px_-6px_rgba(0,0,0,0.35)] md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-500 active:scale-90"
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
    queryKey: ["all-products", "home-ordered"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("homepage_position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Product[];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
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

        </div>
      </section>


    </div>
  );
}
