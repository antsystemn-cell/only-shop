import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { getAnonymousSession } from "@/services/otSession";
import {
  getBasket,
  addItemToBasket,
  editBasketItemQuantity,
  removeBasketItem,
  clearBasket as clearBasketApi,
  runBasketChecking,
  getBasketCheckingResult,
  batchSimplifiedAddItemsToBasket,
  moveItemsBetweenBasketAndNote,
} from "@/services/otApi";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────

export interface OtBasketItem {
  orderLineId: string;
  itemId: string;
  title: string;
  imageUrl: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  currency: string;
  providerType?: string;
  vendorName?: string;
  configurators?: string;
  weight?: number;
  totalPrice: number;
}

export interface OtBasketGroup {
  providerType: string;
  items: OtBasketItem[];
  subtotal: number;
}

interface BasketCheckingStatus {
  isRunning: boolean;
  isComplete: boolean;
  result: any | null;
}

interface OtCartContextType {
  items: OtBasketItem[];
  groups: OtBasketGroup[];
  isLoading: boolean;
  itemCount: number;
  subtotal: number;
  addItem: (itemId: string, quantity: number, configurators?: string, configurationId?: string) => Promise<void>;
  batchAddItems: (xmlParameters: string) => Promise<void>;
  updateItemQuantity: (orderLineId: string, quantity: number) => Promise<void>;
  removeItem: (orderLineId: string) => Promise<void>;
  moveToNote: (orderLineId: string) => Promise<void>;
  moveToBasket: (orderLineId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshBasket: () => Promise<void>;
  checkBasket: () => Promise<any>;
  checkingStatus: BasketCheckingStatus;
}

const OtCartContext = createContext<OtCartContextType | undefined>(undefined);

// ─── Parse basket response ──────────────────────────────────

function parseBasketResponse(data: any): OtBasketItem[] {
  // GetBasket returns CollectionInfo.Elements, not Result.OrderLines
  const elements = data?.CollectionInfo?.Elements || data?.Result?.OrderLines;
  if (!elements) return [];

  const lines = Array.isArray(elements) ? elements : [elements];

  return lines.map((line: any) => ({
    orderLineId: line.Id || "",
    itemId: line.ItemId || "",
    title: line.Title || line.ItemTitle || "",
    imageUrl: line.ImageUrl || line.MainPictureUrl || "",
    quantity: line.Quantity || 1,
    price: line.Price?.ConvertedPrice ?? line.Price?.OriginalPrice ?? 0,
    originalPrice: line.OriginalPrice?.ConvertedPrice ?? line.OriginalPrice?.OriginalPrice,
    currency: line.Price?.CurrencySign || "¥",
    providerType: line.ProviderType || "Unknown",
    vendorName: line.VendorName || "",
    configurators: line.Configurators || "",
    weight: line.Weight,
    totalPrice: (line.Price?.ConvertedPrice ?? line.Price?.OriginalPrice ?? 0) * (line.Quantity || 1),
  }));
}

function groupByProvider(items: OtBasketItem[]): OtBasketGroup[] {
  const groups: Record<string, OtBasketItem[]> = {};
  for (const item of items) {
    const key = item.providerType || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.entries(groups).map(([providerType, items]) => ({
    providerType,
    items,
    subtotal: items.reduce((sum, i) => sum + i.totalPrice, 0),
  }));
}

// ─── Provider ───────────────────────────────────────────────

export function OtCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<OtBasketItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const sessionReady = useRef(false);

  const fetchBasket = useCallback(async () => {
    try {
      setIsLoading(true);
      const sessionId = await getAnonymousSession();
      const data = await getBasket(sessionId);
      const parsed = parseBasketResponse(data);
      setItems(parsed);
    } catch (err) {
      console.error("Failed to fetch basket:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load basket on mount
  useEffect(() => {
    if (!sessionReady.current) {
      sessionReady.current = true;
      fetchBasket();
    }
  }, [fetchBasket]);

  const addItem = useCallback(async (itemId: string, quantity: number, configurators?: string, configurationId?: string) => {
    try {
      setIsLoading(true);
      const sessionId = await getAnonymousSession();
      await addItemToBasket(sessionId, itemId, quantity, configurators, configurationId);
      await fetchBasket();
      toast.success("Сагсанд нэмэгдлээ!");
    } catch (err: any) {
      toast.error(err.message || "Сагсанд нэмэхэд алдаа гарлаа");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchBasket]);

  const updateItemQuantity = useCallback(async (orderLineId: string, quantity: number) => {
    if (quantity <= 0) return;
    try {
      const sessionId = await getAnonymousSession();
      await editBasketItemQuantity(sessionId, orderLineId, quantity);
      setItems((prev) =>
        prev.map((item) =>
          item.orderLineId === orderLineId
            ? { ...item, quantity, totalPrice: item.price * quantity }
            : item
        )
      );
    } catch (err: any) {
      toast.error("Тоо хэмжээ өөрчлөхөд алдаа гарлаа");
      await fetchBasket();
    }
  }, [fetchBasket]);

  const removeItem = useCallback(async (orderLineId: string) => {
    try {
      setItems((prev) => prev.filter((i) => i.orderLineId !== orderLineId));
      const sessionId = await getAnonymousSession();
      await removeBasketItem(sessionId, orderLineId);
    } catch (err: any) {
      toast.error("Бараа устгахад алдаа гарлаа");
      await fetchBasket();
    }
  }, [fetchBasket]);

  const clearCartFn = useCallback(async () => {
    try {
      setItems([]);
      const sessionId = await getAnonymousSession();
      await clearBasketApi(sessionId);
    } catch (err: any) {
      toast.error("Сагс хоослоход алдаа гарлаа");
      await fetchBasket();
    }
  }, [fetchBasket]);

  const batchAddItemsFn = useCallback(async (xmlParameters: string) => {
    try {
      setIsLoading(true);
      const sessionId = await getAnonymousSession();
      await batchSimplifiedAddItemsToBasket(sessionId, xmlParameters);
      await fetchBasket();
      toast.success("Бараанууд сагсанд нэмэгдлээ!");
    } catch (err: any) {
      toast.error(err.message || "Бараа нэмэхэд алдаа гарлаа");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchBasket]);

  const moveToNote = useCallback(async (orderLineId: string) => {
    try {
      const sessionId = await getAnonymousSession();
      await moveItemsBetweenBasketAndNote(sessionId, orderLineId, "ToNote");
      setItems((prev) => prev.filter((i) => i.orderLineId !== orderLineId));
      toast.success("Тэмдэглэл рүү зөөгдлөө");
    } catch (err: any) {
      toast.error("Зөөхөд алдаа гарлаа");
      await fetchBasket();
    }
  }, [fetchBasket]);

  const moveToBasket = useCallback(async (orderLineId: string) => {
    try {
      const sessionId = await getAnonymousSession();
      await moveItemsBetweenBasketAndNote(sessionId, orderLineId, "ToBasket");
      await fetchBasket();
      toast.success("Сагс руу зөөгдлөө");
    } catch (err: any) {
      toast.error("Зөөхөд алдаа гарлаа");
      await fetchBasket();
    }
  }, [fetchBasket]);

  // ─── Basket checking (for checkout) ────────────────────────

  const [checkingStatus, setCheckingStatus] = useState<BasketCheckingStatus>({
    isRunning: false,
    isComplete: false,
    result: null,
  });

  const checkBasket = useCallback(async () => {
    try {
      setCheckingStatus({ isRunning: true, isComplete: false, result: null });
      const sessionId = await getAnonymousSession();
      await runBasketChecking(sessionId);

      // Poll for result
      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
        const result = await getBasketCheckingResult(sessionId) as any;
        if (result?.Result?.IsReady || result?.IsReady) {
          setCheckingStatus({ isRunning: false, isComplete: true, result });
          return result;
        }
        attempts++;
      }
      throw new Error("Basket checking timeout");
    } catch (err: any) {
      setCheckingStatus({ isRunning: false, isComplete: false, result: null });
      toast.error("Сагс шалгахад алдаа гарлаа");
      throw err;
    }
  }, []);

  const groups = groupByProvider(items);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);

  return (
    <OtCartContext.Provider
      value={{
        items,
        groups,
        isLoading,
        itemCount,
        subtotal,
        addItem,
        batchAddItems: batchAddItemsFn,
        updateItemQuantity,
        removeItem,
        moveToNote,
        moveToBasket,
        clearCart: clearCartFn,
        refreshBasket: fetchBasket,
        checkBasket,
        checkingStatus,
      }}
    >
      {children}
    </OtCartContext.Provider>
  );
}

export function useOtCart() {
  const context = useContext(OtCartContext);
  if (!context) {
    throw new Error("useOtCart must be used within an OtCartProvider");
  }
  return context;
}

/** Safe version that returns defaults when outside OtCartProvider */
export function useOtCartSafe() {
  const context = useContext(OtCartContext);
  if (!context) {
    return {
      items: [] as OtBasketItem[],
      groups: [] as OtBasketGroup[],
      isLoading: false,
      itemCount: 0,
      subtotal: 0,
      addItem: async () => {},
      batchAddItems: async () => {},
      updateItemQuantity: async () => {},
      removeItem: async () => {},
      moveToNote: async () => {},
      moveToBasket: async () => {},
      clearCart: async () => {},
      refreshBasket: async () => {},
      checkBasket: async () => ({}),
      checkingStatus: { isRunning: false, isComplete: false, result: null },
    } as OtCartContextType;
  }
  return context;
}
