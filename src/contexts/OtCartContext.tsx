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
  getItemBasicInfo,
} from "@/services/otApi";
import { toast } from "sonner";
import { getPriceConfig, calculateMntPrice, getOriginalCurrencyCode } from "@/utils/priceCalculator";

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
  invalidItems?: BasketInvalidItem[];
}

export interface BasketInvalidItem {
  elementId: string;
  itemId?: string;
  title?: string;
  reasonCode: string;
  reasonText: string;
  isPriceChanged?: boolean;
}

interface OtCartContextType {
  items: OtBasketItem[];
  groups: OtBasketGroup[];
  isLoading: boolean;
  itemCount: number;
  subtotal: number;
  addItem: (itemId: string, quantity: number, configurators?: string, configurationId?: string, fieldParameters?: string) => Promise<void>;
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

function parseBasketResponse(data: any, priceConfig?: Awaited<ReturnType<typeof getPriceConfig>> | null): OtBasketItem[] {
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

    // Minimal debug
    console.log("[OtCart] Line ItemId:", line.ItemId, "ProviderType:", line.ProviderType, "Price:", JSON.stringify(line.Price));

    // ── Price extraction (MNT) ──
    const fullTotalInternal = line.FullTotalCost?.ConvertedPriceList?.Internal?.Price;
    const totalCostInternal = line.TotalCost?.ConvertedPriceList?.Internal?.Price;
    const priceInternal = line.Price?.ConvertedPriceList?.Internal?.Price;
    const rawNumericPrice = typeof line.Price === "number" ? line.Price : 
                            typeof line.Price?.OriginalPrice === "number" ? line.Price.OriginalPrice : 0;
    
    let totalPrice = fullTotalInternal ?? totalCostInternal ?? (priceInternal ? priceInternal * quantity : rawNumericPrice * quantity);
    let unitPrice = totalPrice / (quantity || 1);

    // ── If no Internal conversion available (e.g. Amazon USD items), convert using our price config ──
    const hasInternalConversion = fullTotalInternal != null || totalCostInternal != null || priceInternal != null;
    if (!hasInternalConversion && rawNumericPrice > 0 && priceConfig) {
      const currencyCode = getOriginalCurrencyCode(line.Price) || 
        line.Price?.ConvertedPriceList?.Original?.CurrencyCode || 
        line.Price?.CurrencyCode ||
        (line.ProviderType === "Amazon" ? "USD" : "CNY");
      const providerType = line.ProviderType || "Taobao";
      unitPrice = calculateMntPrice(rawNumericPrice, currencyCode, providerType, priceConfig);
      totalPrice = unitPrice * quantity;
      console.log(`[OtCart] Manual conversion: ${rawNumericPrice} ${currencyCode} → ${unitPrice}₮ (provider: ${providerType})`);
    }

    const originalCnyPrice = line.Price?.OriginalPrice 
      ?? line.Price?.ConvertedPriceList?.Original?.Price
      ?? (typeof line.Price === "number" ? line.Price : undefined);
    const originalCnyCurrency = line.Price?.ConvertedPriceList?.Original?.Sign || "¥";

    const currency = line.FullTotalCost?.ConvertedPriceList?.Internal?.Sign
      ?? line.Price?.ConvertedPriceList?.Internal?.Sign
      ?? "₮";

    // ── Title: prefer OriginalTitle or ItemTitle over configurator-only title ──
    const mainTitle = line.OriginalTitle || line.ItemTitle || line.Title || "";

    // ── Image: try multiple paths ──
    const imageUrl = line.ImageUrl
      || line.MainPictureUrl
      || line.ItemPicture?.Url
      || line.Pictures?.ItemPicture?.Url
      || line.Picture?.Url
      || line.PictureUrl
      || line.ThumbUrl
      || "";

    // ── Configurator display text ──
    const configs = line.Configuration?.Configurator || line.Configurators;
    let configList = Array.isArray(configs) ? configs : configs ? [configs] : [];
    const configText = configList
      .map((c: any) => {
        if (typeof c === "string") return c;
        // Show "PropertyName: Value" format for clarity
        const name = c.Title || c.PropertyName || c.Name || "";
        const val = c.Value || c.ValueTitle || "";
        return name && val ? `${name}: ${val}` : val || name || "";
      })
      .filter(Boolean)
      .join(", ");

    return {
      orderLineId: String(line.Id || ""),
      itemId: line.ItemId || "",
      title: mainTitle || line.ItemId || "",
      imageUrl,
      quantity,
      price: unitPrice,
      originalPrice: line.OriginalPrice?.ConvertedPrice ?? line.OriginalPrice?.OriginalPrice,
      currency,
      providerType: line.ProviderType || "Taobao",
      vendorName: line.VendorName || "",
      configurators: configText || "",
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

  // Cache for item basic info (title + image) by itemId
  const itemInfoCache = useRef<Record<string, { title: string; imageUrl: string }>>({});

  const enrichItems = useCallback(async (parsed: OtBasketItem[]): Promise<OtBasketItem[]> => {
    // Find items missing title or image
    const needsEnrich = parsed.filter(
      (item) => (!item.title || item.title === item.itemId) && item.itemId && !itemInfoCache.current[item.itemId]
    );
    // Also enrich items that have no imageUrl
    const needsImage = parsed.filter(
      (item) => !item.imageUrl && item.itemId && !itemInfoCache.current[item.itemId] && !needsEnrich.find(n => n.itemId === item.itemId)
    );
    const allNeeds = [...needsEnrich, ...needsImage];

    // Fetch missing info in parallel
    if (allNeeds.length > 0) {
      const uniqueIds = [...new Set(allNeeds.map((i) => i.itemId))];
      const results = await Promise.all(uniqueIds.map((id) => getItemBasicInfo(id)));
      uniqueIds.forEach((id, idx) => {
        itemInfoCache.current[id] = results[idx];
      });
    }

    // Merge cached info into items
    return parsed.map((item) => {
      const cached = itemInfoCache.current[item.itemId];
      if (!cached) return item;
      return {
        ...item,
        title: item.title && item.title !== item.itemId ? item.title : cached.title || item.title,
        imageUrl: item.imageUrl || cached.imageUrl || "",
      };
    });
  }, []);

  const fetchBasket = useCallback(async () => {
    try {
      setIsLoading(true);
      const [sessionId, priceConfig] = await Promise.all([
        getAnonymousSession(),
        getPriceConfig(),
      ]);
      const data = await getBasket(sessionId);
      const parsed = parseBasketResponse(data, priceConfig);
      const enriched = await enrichItems(parsed);
      setItems(enriched);
    } catch (err) {
      console.error("Failed to fetch basket:", err);
    } finally {
      setIsLoading(false);
    }
  }, [enrichItems]);

  // Load basket on mount
  useEffect(() => {
    if (!sessionReady.current) {
      sessionReady.current = true;
      fetchBasket();
    }
  }, [fetchBasket]);

  const addItem = useCallback(async (itemId: string, quantity: number, configurators?: string, configurationId?: string, fieldParameters?: string) => {
    try {
      setIsLoading(true);
      const sessionId = await getAnonymousSession();
      await addItemToBasket(sessionId, itemId, quantity, configurators, configurationId, fieldParameters);
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
    const correlationId = Math.random().toString(36).substring(2, 10);
    console.log(`[OtCart][${correlationId}] Checkout: checkBasket started`);
    try {
      setCheckingStatus({ isRunning: true, isComplete: false, result: null, invalidItems: [] });
      const sessionId = await getAnonymousSession();

      // Step 1: Get basket element IDs
      const basketData = await getBasket(sessionId) as any;
      const elements = basketData?.CollectionInfo?.Elements
        || basketData?.Result?.CollectionInfo?.Elements;
      const elementsList = elements ? (Array.isArray(elements) ? elements : [elements]) : [];

      if (elementsList.length === 0) {
        console.log(`[OtCart][${correlationId}] Empty basket, aborting check`);
        throw new Error("EMPTY_BASKET");
      }

      const elementIds = elementsList.map((el: any) => String(el.Id)).filter(Boolean).join(",");
      console.log(`[OtCart][${correlationId}] RunBasketChecking with ${elementsList.length} elements, ids: ${elementIds}`);

      // Step 2: Run basket checking - returns { activityId: string, raw: any }
      const { activityId } = await runBasketChecking(sessionId, elementIds);
      console.log(`[OtCart][${correlationId}] activityId: "${activityId}" (type: ${typeof activityId})`);

      // Safety: activityId must be a string
      if (typeof activityId !== "string" || !activityId) {
        console.error(`[OtCart][${correlationId}] Invalid activityId:`, activityId);
        throw new Error("BASKET_CHECK_NO_ACTIVITY_ID");
      }

      // Step 3: Poll with backoff
      return await pollBasketCheckingResult(sessionId, activityId, correlationId);
    } catch (err: any) {
      console.error(`[OtCart][${correlationId}] checkBasket error:`, err.message);

      // NotFound fallback: retry once with fresh RunBasketChecking
      if (err.message?.includes("NotFound") || err.message?.includes("not found")) {
        console.log(`[OtCart][${correlationId}] NotFound detected, retrying basket check...`);
        try {
          const sessionId = await getAnonymousSession();
          const { activityId: retryId } = await runBasketChecking(sessionId);
          console.log(`[OtCart][${correlationId}] Retry activityId: "${retryId}"`);
          return await pollBasketCheckingResult(sessionId, retryId, correlationId + "-retry");
        } catch (retryErr: any) {
          console.error(`[OtCart][${correlationId}] Retry also failed:`, retryErr.message);
          setCheckingStatus({ isRunning: false, isComplete: false, result: null });
          throw retryErr;
        }
      }

      setCheckingStatus({ isRunning: false, isComplete: false, result: null });
      throw err;
    }
  }, []);

  // Extracted polling logic for reuse in retries
  const pollBasketCheckingResult = useCallback(async (sessionId: string, activityId: string, correlationId: string) => {
    const backoffMs = [500, 1000, 1500, 2000, 2500, 3000, 3000, 3000, 3000, 3000, 3000, 3000];
    let attempts = 0;
    const maxAttempts = 25;
    const maxTotalMs = 60000;
    const startTime = Date.now();

    while (attempts < maxAttempts && (Date.now() - startTime) < maxTotalMs) {
      const delay = backoffMs[Math.min(attempts, backoffMs.length - 1)];
      await new Promise((r) => setTimeout(r, delay));
      attempts++;

      console.log(`[OtCart][${correlationId}] Poll #${attempts}, activityId: "${activityId}"`);
      const result = await getBasketCheckingResult(sessionId, activityId) as any;

      // OTAPI returns IsFinished (not IsReady)
      const resultObj = result?.Result || result;
      const isFinished = resultObj?.IsFinished || resultObj?.IsReady;
      console.log(`[OtCart][${correlationId}] Poll #${attempts} IsFinished:`, resultObj?.IsFinished, "ProgressPercent:", resultObj?.ProgressPercent);
      
      if (isFinished) {
        console.log(`[OtCart][${correlationId}] Check complete after ${attempts} polls`);

        // Parse invalid items from Messages array
        // OTAPI returns: { Messages: [{ ElementId: {Value}, Status, Code, Text }], IsFinished, ProgressPercent }
        const messages = resultObj?.Messages;
        const msgList = messages ? (Array.isArray(messages) ? messages : [messages]) : [];

        const PRICE_CHANGE_CODES = ["PriceChanged", "PriceHasBeenChanged", "ContentChanged", "PriceChange"];

        const invalidItems: BasketInvalidItem[] = msgList
          .filter((msg: any) => {
            const status = msg.Status || msg.Code;
            return status && status !== "Ok";
          })
          .map((msg: any) => {
            const elementId = msg.ElementId?.Value ? String(msg.ElementId.Value) : String(msg.ElementId || "");
            const code = msg.Code || msg.Status || "UNKNOWN";
            const isPriceChanged = PRICE_CHANGE_CODES.some(pc => code.toLowerCase().includes(pc.toLowerCase()));
            return {
              elementId,
              itemId: msg.ItemId || "",
              title: msg.Text || msg.Title || "",
              reasonCode: code,
              reasonText: msg.Text || msg.Code || "Тодорхойгүй",
              isPriceChanged,
            };
          });

        if (invalidItems.length > 0) {
          console.log(`[OtCart][${correlationId}] Found ${invalidItems.length} invalid items (price changed: ${invalidItems.filter(i => i.isPriceChanged).length})`);
          setCheckingStatus({ isRunning: false, isComplete: true, result, invalidItems });
          return { ...result, _invalidItems: invalidItems };
        }

        setCheckingStatus({ isRunning: false, isComplete: true, result, invalidItems: [] });
        return result;
      }
    }

    console.warn(`[OtCart][${correlationId}] Basket checking timed out after ${attempts} polls`);
    throw new Error("CHECK_TIMEOUT");
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
