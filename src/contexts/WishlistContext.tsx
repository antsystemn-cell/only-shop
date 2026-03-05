import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useToast } from "@/hooks/use-toast";

interface WishlistContextType {
  wishlistIds: string[];
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWishlist();
    } else {
      setWishlistIds([]);
    }
  }, [user]);

  const fetchWishlist = async () => {
    if (!user) return;

    const [localRes, otRes] = await Promise.all([
      supabase.from("wishlists").select("product_id").eq("user_id", user.id),
      supabase.from("ot_wishlists" as any).select("product_id").eq("user_id", user.id),
    ]);

    const localIds = (localRes.data || []).map((item) => item.product_id);
    const otData = (otRes.data as unknown as Array<{ product_id: string }>) || [];
    const otIds = otData.map((item) => item.product_id);

    setWishlistIds(Array.from(new Set([...localIds, ...otIds])));
  };

  const isInWishlist = (productId: string) => {
    return wishlistIds.includes(productId);
  };

  const toggleWishlist = async (productId: string) => {
    if (!user) {
      toast({
        title: "Нэвтрэх шаардлагатай",
        description: "Хүслийн жагсаалтанд нэмэхийн тулд нэвтэрнэ үү",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const localProduct = isUuid(productId);

    try {
      if (isInWishlist(productId)) {
        const { error } = localProduct
          ? await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", productId)
          : await supabase.from("ot_wishlists" as any).delete().eq("user_id", user.id).eq("product_id", productId);

        if (error) throw error;

        setWishlistIds((prev) => prev.filter((id) => id !== productId));
        toast({
          title: "Хасагдлаа",
          description: "Хүслийн жагсаалтаас хасагдлаа",
        });
      } else {
        const { error } = localProduct
          ? await supabase.from("wishlists").insert({ user_id: user.id, product_id: productId })
          : await supabase.from("ot_wishlists" as any).insert({ user_id: user.id, product_id: productId });

        if (error) throw error;

        setWishlistIds((prev) => [...prev, productId]);
        toast({
          title: "Нэмэгдлээ",
          description: "Хүслийн жагсаалтанд нэмэгдлээ",
        });
      }
    } catch (error: any) {
      toast({
        title: "Алдаа",
        description: error?.message || "Хүслийн жагсаалтын үйлдэл амжилтгүй боллоо",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <WishlistContext.Provider value={{ wishlistIds, isInWishlist, toggleWishlist, isLoading }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
