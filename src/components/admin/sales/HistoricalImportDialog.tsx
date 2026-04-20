import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { createManualSale } from "@/lib/sales/salesService";
import { Upload, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Row {
  sale_date: string;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount: number;
  payment_method: string;
  notes: string;
  _status?: "pending" | "ok" | "error";
  _error?: string;
}

const EMPTY_ROW: Row = {
  sale_date: new Date().toISOString().slice(0, 10),
  customer_name: "",
  customer_phone: "",
  product_name: "",
  sku: "",
  quantity: 1,
  unit_price: 0,
  unit_cost: 0,
  discount: 0,
  payment_method: "cash",
  notes: "",
};

const CSV_TEMPLATE =
  "sale_date,customer_name,customer_phone,product_name,sku,quantity,unit_price,unit_cost,discount,payment_method,notes\n" +
  "2024-01-15,Бат,99119911,Жишээ бараа,SKU-001,2,50000,30000,0,cash,түүхэн борлуулалт";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HistoricalImportDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [affectsInventory, setAffectsInventory] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });

  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const obj: any = {};
      headers.forEach((h, i) => (obj[h] = cells[i] || ""));
      return {
        sale_date: obj.sale_date || new Date().toISOString().slice(0, 10),
        customer_name: obj.customer_name || "",
        customer_phone: obj.customer_phone || "",
        product_name: obj.product_name || "",
        sku: obj.sku || "",
        quantity: Number(obj.quantity) || 1,
        unit_price: Number(obj.unit_price) || 0,
        unit_cost: Number(obj.unit_cost) || 0,
        discount: Number(obj.discount) || 0,
        payment_method: obj.payment_method || "cash",
        notes: obj.notes || "",
      } as Row;
    });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    setRows(parsed);
    toast({ title: `${parsed.length} мөр уншсан` });
  };

  const updateRow = (idx: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, k) => (k === idx ? { ...r, ...patch } : r)));
  const removeRow = (idx: number) =>
    setRows((prev) => prev.filter((_, k) => k !== idx));

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setProgress({ done: 0, total: rows.length, ok: 0, fail: 0 });

    const updated = [...rows];
    let ok = 0, fail = 0;

    for (let i = 0; i < updated.length; i++) {
      const r = updated[i];
      try {
        const subtotal = r.unit_price * r.quantity;
        await createManualSale({
          source_type: "historical_sale",
          is_historical: true,
          sale_date: new Date(r.sale_date).toISOString(),
          customer_name: r.customer_name || null,
          customer_phone: r.customer_phone || null,
          customer_email: null,
          payment_method: r.payment_method,
          payment_status: "paid",
          fulfillment_status: "delivered",
          should_create_delivery: false,
          affects_inventory: affectsInventory,
          affects_analytics: true,
          affects_revenue: true,
          discount_amount: r.discount,
          delivery_fee: 0,
          notes: r.notes || null,
          internal_note: "Historical import",
          address_text: null,
          items: [
            {
              product_id: null,
              variant_id: null,
              product_name: r.product_name,
              sku: r.sku || null,
              unit_price: r.unit_price,
              unit_cost: r.unit_cost,
              quantity: r.quantity,
            },
          ],
        });
        updated[i] = { ...r, _status: "ok" };
        ok++;
      } catch (err: any) {
        updated[i] = { ...r, _status: "error", _error: err?.message || String(err) };
        fail++;
      }
      setProgress({ done: i + 1, total: updated.length, ok, fail });
      setRows([...updated]);
    }

    setImporting(false);
    qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    qc.invalidateQueries({ queryKey: ["admin", "sales"] });
    toast({
      title: "Импорт дууслаа",
      description: `Амжилттай: ${ok}, Алдаа: ${fail}`,
    });
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historical_sales_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Түүхэн борлуулалт массаар оруулах</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 rounded-lg text-sm flex gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <strong>Анхааруулга:</strong> Эдгээр борлуулалтууд хүргэлтийн API
              дуудахгүй (should_create_delivery=false). Зөвхөн statistics, нөөц,
              орлогын мэдээлэлд тусна.
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              CSV загвар татах
            </Button>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFile}
              />
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-1" /> CSV upload
                </span>
              </Button>
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRows((p) => [...p, { ...EMPTY_ROW }])}
            >
              + Мөр нэмэх
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Switch
                checked={affectsInventory}
                onCheckedChange={setAffectsInventory}
                id="aff-inv"
              />
              <Label htmlFor="aff-inv" className="text-sm">
                Нөөц хасах
              </Label>
            </div>
          </div>

          {progress.total > 0 && (
            <div className="text-sm">
              Явц: {progress.done}/{progress.total} ·{" "}
              <span className="text-green-600">✓ {progress.ok}</span> ·{" "}
              <span className="text-destructive">✗ {progress.fail}</span>
            </div>
          )}

          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Огноо</th>
                  <th className="p-2 text-left">Утас</th>
                  <th className="p-2 text-left">Бараа</th>
                  <th className="p-2">Тоо</th>
                  <th className="p-2">Үнэ</th>
                  <th className="p-2">Өртөг</th>
                  <th className="p-2">Төлөв</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      CSV upload эсвэл "Мөр нэмэх" дарж эхлэнэ үү
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-1">
                        <Input
                          type="date"
                          value={r.sale_date}
                          onChange={(e) => updateRow(idx, { sale_date: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={r.customer_phone}
                          onChange={(e) => updateRow(idx, { customer_phone: e.target.value })}
                          className="h-8 text-xs w-24"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={r.product_name}
                          onChange={(e) => updateRow(idx, { product_name: e.target.value })}
                          className="h-8 text-xs min-w-[140px]"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          type="number"
                          value={r.quantity}
                          onChange={(e) => updateRow(idx, { quantity: Number(e.target.value) })}
                          className="h-8 text-xs w-16"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          type="number"
                          value={r.unit_price}
                          onChange={(e) => updateRow(idx, { unit_price: Number(e.target.value) })}
                          className="h-8 text-xs w-24"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          type="number"
                          value={r.unit_cost}
                          onChange={(e) => updateRow(idx, { unit_cost: Number(e.target.value) })}
                          className="h-8 text-xs w-24"
                        />
                      </td>
                      <td className="p-1 text-center">
                        {r._status === "ok" && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3 mr-1" />OK
                          </Badge>
                        )}
                        {r._status === "error" && (
                          <Badge variant="destructive" title={r._error}>
                            Алдаа
                          </Badge>
                        )}
                      </td>
                      <td className="p-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeRow(idx)}
                          className="h-7 w-7"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Хаах
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || rows.length === 0}
          >
            {importing ? `Импортлож байна... (${progress.done}/${progress.total})` : `${rows.length} мөр импортлох`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
