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

    const { data, error } = await supabase
      .from("ot_wishlists")
      .select("product_id")
      .eq("user_id", user.id);

    if (!error && data) {
      setWishlistIds(data.map((item) => item.product_id));
    }
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

    try {
      if (isInWishlist(productId)) {
        const { error } = await supabase
          .from("ot_wishlists")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);

        if (error) throw error;

        setWishlistIds((prev) => prev.filter((id) => id !== productId));
        toast({
          title: "Хасагдлаа",
          description: "Хүслийн жагсаалтаас хасагдлаа",
        });
      } else {
        const { error } = await supabase
          .from("ot_wishlists")
          .insert({ user_id: user.id, product_id: productId });

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

const defaultWishlist: WishlistContextType = {
  wishlistIds: [],
  isInWishlist: () => false,
  toggleWishlist: async () => {},
  isLoading: false,
};

export function useWishlist() {
  const context = useContext(WishlistContext);
  return context ?? defaultWishlist;
}
