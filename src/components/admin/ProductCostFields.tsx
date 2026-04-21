import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  calcUnitMargin,
  getMarginColorClass,
  getProfitColorClass,
  formatPct,
} from "@/lib/profit/profitCalculator";
import { TrendingUp, AlertTriangle } from "lucide-react";

export interface ProductCostFieldsValue {
  cost_price: string;
  landed_cost: string;
  additional_cost: string;
  packaging_cost: string;
  default_delivery_cost: string;
  low_margin_threshold: string;
}

interface Props {
  value: ProductCostFieldsValue;
  onChange: (next: ProductCostFieldsValue) => void;
  sellingPrice: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("mn-MN").format(Math.round(n)) + "₮";
}

export function ProductCostFields({ value, onChange, sellingPrice }: Props) {
  const set = (k: keyof ProductCostFieldsValue, v: string) =>
    onChange({ ...value, [k]: v });

  const landed = parseFloat(value.landed_cost) || 0;
  const cost = parseFloat(value.cost_price) || 0;
  const additional = parseFloat(value.additional_cost) || 0;
  const effectiveCost = landed > 0 ? landed : cost > 0 ? cost + additional : 0;
  const lowThreshold = parseFloat(value.low_margin_threshold) || 15;

  const m = calcUnitMargin(sellingPrice, effectiveCost, lowThreshold);

  return (
    <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-sm">Өртөг & Ашгийн тооцоо</h4>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        <strong>landed_cost</strong> (карго орсон) нь нэн тэргүүнд ашиглагдана.
        Хоосон бол <strong>cost_price + нэмэлт</strong> ашиглана.
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cost_price" className="text-xs">Худалдан авсан өртөг (₮)</Label>
          <Input
            id="cost_price" type="number" min="0"
            value={value.cost_price}
            onChange={(e) => set("cost_price", e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="landed_cost" className="text-xs">
            Бэлэн өртөг (карготой) (₮) <span className="text-primary">★</span>
          </Label>
          <Input
            id="landed_cost" type="number" min="0"
            value={value.landed_cost}
            onChange={(e) => set("landed_cost", e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="additional_cost" className="text-xs">Нэмэлт өртөг (₮)</Label>
          <Input
            id="additional_cost" type="number" min="0"
            value={value.additional_cost}
            onChange={(e) => set("additional_cost", e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="packaging_cost" className="text-xs">Сав баглаа (₮)</Label>
          <Input
            id="packaging_cost" type="number" min="0"
            value={value.packaging_cost}
            onChange={(e) => set("packaging_cost", e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="default_delivery_cost" className="text-xs">Хүргэлтийн өртөг (₮)</Label>
          <Input
            id="default_delivery_cost" type="number" min="0"
            value={value.default_delivery_cost}
            onChange={(e) => set("default_delivery_cost", e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="low_margin_threshold" className="text-xs">Бага ашгийн босго (%)</Label>
          <Input
            id="low_margin_threshold" type="number" min="0" max="100"
            value={value.low_margin_threshold}
            onChange={(e) => set("low_margin_threshold", e.target.value)}
            placeholder="15"
          />
        </div>
      </div>

      {/* Live margin preview */}
      <div className="border rounded-md bg-background p-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Зарах үнэ</span>
          <span className="font-medium">{fmt(sellingPrice)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Үр дүнтэй өртөг</span>
          <span className="font-medium">{fmt(effectiveCost)}</span>
        </div>
        <div className="flex items-center justify-between text-sm border-t pt-1.5">
          <span className="font-medium">Нэгжийн ашиг</span>
          <span className={`font-bold ${getProfitColorClass(m.profit)}`}>
            {fmt(m.profit)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Маржин</span>
          <span className={`font-bold ${getMarginColorClass(m.marginPct, lowThreshold)}`}>
            {formatPct(m.marginPct)}
          </span>
        </div>
        {m.hasNoCost && (
          <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 p-2 rounded mt-2">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>Өртөг тохируулаагүй тул бодит ашиг тооцоологдохгүй.</span>
          </div>
        )}
        {!m.hasNoCost && m.isLowMargin && (
          <div className="flex items-start gap-1.5 text-[11px] text-orange-700 bg-orange-50 p-2 rounded mt-2">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>Маржин {formatPct(m.marginPct)} нь босго {formatPct(lowThreshold)}-аас доогуур байна.</span>
          </div>
        )}
      </div>
    </div>
  );
}
