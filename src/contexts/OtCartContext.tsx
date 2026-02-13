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
  originalCnyPrice?: number;
  originalCnyCurrency?: string;
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
  const elements = data?.CollectionInfo?.Elements
    || data?.Result?.CollectionInfo?.Elements
    || data?.Result?.OrderLines
    || data?.OrderLines;
  if (!elements) {
    console.warn("[OtCart] No basket elements found. Keys:", Object.keys(data?.Result || data || {}));
    return [];
  }

  const lines = Array.isArray(elements) ? elements : [elements];
  console.log("[OtCart] Parsing", lines.length, "basket lines");

  return lines.map((line: any) => {
    const quantity = line.Quantity || 1;

    // ── Price extraction (MNT) ──
    // Try multiple paths for internal MNT price
    const fullTotalInternal = line.FullTotalCost?.ConvertedPriceList?.Internal?.Price;
    const totalCostInternal = line.TotalCost?.ConvertedPriceList?.Internal?.Price;
    const priceInternal = line.Price?.ConvertedPriceList?.Internal?.Price;
    // Raw numeric price fallback
    const rawNumericPrice = typeof line.Price === "number" ? line.Price : 
                            typeof line.Price?.OriginalPrice === "number" ? line.Price.OriginalPrice : 0;
    
    // Best total price in MNT
    const totalPrice = fullTotalInternal ?? totalCostInternal ?? (priceInternal ? priceInternal * quantity : rawNumericPrice * quantity);
    const unitPrice = totalPrice / (quantity || 1);

    // Original price in foreign currency (CNY/USD) for admin reference
    const originalCnyPrice = line.Price?.OriginalPrice 
      ?? line.Price?.ConvertedPriceList?.Original?.Price
      ?? (typeof line.Price === "number" ? line.Price : undefined);
    const originalCnyCurrency = line.Price?.ConvertedPriceList?.Original?.Sign || "¥";

    console.log("[OtCart] Item", line.ItemId, "totalPrice:", totalPrice, "unitPrice:", unitPrice, "originalCny:", originalCnyPrice);

    // Currency: prefer Internal sign (₮)
    const currency = line.FullTotalCost?.ConvertedPriceList?.Internal?.Sign
      ?? line.Price?.ConvertedPriceList?.Internal?.Sign
      ?? "₮";

    const title = line.Title || line.ItemTitle || "";

    // Image: try multiple paths
    const imageUrl = line.ImageUrl
      || line.MainPictureUrl
      || line.ItemPicture?.Url
      || line.Pictures?.ItemPicture?.Url
      || line.Picture?.Url
      || "";

    // Extract configurator display text
    const configs = line.Configuration?.Configurator;
    const configText = Array.isArray(configs)
      ? configs.map((c: any) => c.Value).join(", ")
      : configs?.Value || "";

    return {
      orderLineId: String(line.Id || ""),
      itemId: line.ItemId || "",
      title: title || configText || line.ItemId || "",
      imageUrl,
      quantity,
      price: unitPrice,
      originalPrice: line.OriginalPrice?.ConvertedPrice ?? line.OriginalPrice?.OriginalPrice,
      currency,
      providerType: line.ProviderType || "Taobao",
      vendorName: line.VendorName || "",
      configurators: line.Configurators || configText || "",
      weight: line.Weight,
      totalPrice,
      originalCnyPrice,
      originalCnyCurrency,
    } as OtBasketItem;
  });
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
