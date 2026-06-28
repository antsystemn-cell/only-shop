export function profitPerUnit(costPrice: number, sellingPrice: number): number {
  return sellingPrice - costPrice;
}

export function marginPercent(costPrice: number, sellingPrice: number): number {
  if (!sellingPrice || sellingPrice === 0) return 0;
  return Math.round(((sellingPrice - costPrice) / sellingPrice) * 1000) / 10;
}

export function marginColor(margin: number): "green" | "amber" | "red" {
  if (margin >= 40) return "green";
  if (margin >= 20) return "amber";
  return "red";
}

export function marginColorClass(margin: number): string {
  const c = marginColor(margin);
  if (c === "green") return "text-green-600";
  if (c === "amber") return "text-amber-600";
  return "text-destructive";
}

export function stockValue(costPrice: number, stock: number): number {
  return costPrice * stock;
}

export function stockValueAtSelling(sellingPrice: number, stock: number): number {
  return sellingPrice * stock;
}

export function potentialProfit(costPrice: number, sellingPrice: number, stock: number): number {
  return (sellingPrice - costPrice) * stock;
}

export function avgDailySales(totalSold: number, daysPeriod = 30): number {
  if (daysPeriod === 0) return 0;
  return totalSold / daysPeriod;
}

export function daysOfStock(stock: number, avgDaily: number): number | null {
  if (!avgDaily || avgDaily === 0) return null;
  return Math.round(stock / avgDaily);
}

export type StockStatus = "out" | "low" | "stale" | "ok";

export function stockStatus(
  stock: number,
  threshold: number,
  lastSoldDaysAgo: number | null,
): StockStatus {
  if (stock <= 0) return "out";
  if (stock <= threshold) return "low";
  if (lastSoldDaysAgo !== null && lastSoldDaysAgo >= 60) return "stale";
  return "ok";
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  out: "Дууссан",
  low: "Бага",
  stale: "Түр идэвхгүй",
  ok: "Хэвийн",
};

export const STOCK_STATUS_BADGE: Record<StockStatus, string> = {
  out: "bg-destructive/15 text-destructive border-destructive/30",
  low: "bg-amber-100 text-amber-800 border-amber-300",
  stale: "bg-purple-100 text-purple-800 border-purple-300",
  ok: "bg-green-100 text-green-800 border-green-300",
};

export interface ProductWithCalc {
  id: string;
  name: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  soldLast30Days: number;
  lastSoldDaysAgo: number | null;
  lowStockThreshold: number;
}

export function calcInventorySummary(products: ProductWithCalc[]) {
  const totalStockCost = products.reduce((s, p) => s + stockValue(p.costPrice, p.stock), 0);
  const totalStockSelling = products.reduce(
    (s, p) => s + stockValueAtSelling(p.sellingPrice, p.stock),
    0,
  );
  const totalPotentialProfit = totalStockSelling - totalStockCost;
  const staleProducts = products.filter(
    (p) => stockStatus(p.stock, p.lowStockThreshold, p.lastSoldDaysAgo) === "stale",
  );
  const totalStaleValue = staleProducts.reduce((s, p) => s + stockValue(p.costPrice, p.stock), 0);

  return {
    totalSku: products.length,
    totalStockCost,
    totalStockSelling,
    totalPotentialProfit,
    totalStaleValue,
    staleCount: staleProducts.length,
  };
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantitySold: number;
  unitPrice: number;
  costPrice: number;
}

export function calcSalesProfitByProduct(items: SaleItem[]) {
  const map = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
  for (const item of items) {
    const prev = map.get(item.productId) ?? {
      name: item.productName,
      qty: 0,
      revenue: 0,
      cost: 0,
    };
    map.set(item.productId, {
      name: item.productName,
      qty: prev.qty + item.quantitySold,
      revenue: prev.revenue + item.unitPrice * item.quantitySold,
      cost: prev.cost + item.costPrice * item.quantitySold,
    });
  }
  return Array.from(map.entries())
    .map(([id, d]) => {
      const avgPrice = d.qty ? d.revenue / d.qty : 0;
      const avgCost = d.qty ? d.cost / d.qty : 0;
      return {
        productId: id,
        name: d.name,
        qtySold: d.qty,
        revenue: d.revenue,
        cost: d.cost,
        profit: d.revenue - d.cost,
        margin: marginPercent(avgCost, avgPrice),
      };
    })
    .sort((a, b) => b.profit - a.profit);
}
