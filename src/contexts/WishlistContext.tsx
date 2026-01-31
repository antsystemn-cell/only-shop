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
      .from("wishlists")
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

    if (isInWishlist(productId)) {
      // Remove from wishlist
      const { error } = await supabase
        .from("wishlists")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);

      if (!error) {
        setWishlistIds((prev) => prev.filter((id) => id !== productId));
        toast({
          title: "Хасагдлаа",
          description: "Хүслийн жагсаалтаас хасагдлаа",
        });
      }
    } else {
      // Add to wishlist
      const { error } = await supabase
        .from("wishlists")
        .insert({ user_id: user.id, product_id: productId });

      if (!error) {
        setWishlistIds((prev) => [...prev, productId]);
        toast({
          title: "Нэмэгдлээ",
          description: "Хүслийн жагсаалтанд нэмэгдлээ",
        });
      }
    }

    setIsLoading(false);
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
