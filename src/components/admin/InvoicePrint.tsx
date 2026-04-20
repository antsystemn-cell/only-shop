import { format } from "date-fns";

interface InvoicePrintOrder {
  order_number: string;
  sale_date?: string;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  address_text?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  total: number;
  notes?: string | null;
  order_items?: Array<{
    product_name_snapshot?: string | null;
    sku_snapshot?: string | null;
    variant_name_snapshot?: string | null;
    color_snapshot?: string | null;
    size_snapshot?: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

/**
 * Open a new window and print an invoice (нэхэмжлэх) for a sale/order.
 * Style is intentionally minimal so it prints cleanly on A5/A4.
 */
export function printInvoice(order: InvoicePrintOrder, shopName = "Only Shop") {
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) return;

  const items = order.order_items || [];
  const fmt = (n: number) => Number(n || 0).toLocaleString() + "₮";
  const date = format(new Date(order.sale_date || order.created_at), "yyyy-MM-dd HH:mm");

  const itemRows = items
    .map((it) => {
      const variant = [it.variant_name_snapshot, it.color_snapshot, it.size_snapshot]
        .filter(Boolean).join(" / ");
      return `
        <tr>
          <td>
            <div style="font-weight:600">${escapeHtml(it.product_name_snapshot || "—")}</div>
            ${variant ? `<div style="font-size:11px;color:#666">${escapeHtml(variant)}</div>` : ""}
            ${it.sku_snapshot ? `<div style="font-size:10px;color:#999">SKU: ${escapeHtml(it.sku_snapshot)}</div>` : ""}
          </td>
          <td style="text-align:center">${it.quantity}</td>
          <td style="text-align:right">${fmt(it.unit_price)}</td>
          <td style="text-align:right">${fmt(it.total_price)}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
<!doctype html>
<html lang="mn">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(order.order_number)} — Нэхэмжлэх</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #666; font-size: 12px; }
  .row { display: flex; justify-content: space-between; gap: 24px; margin: 16px 0; }
  .box { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .box h3 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 13px; vertical-align: top; }
  th { background: #f8fafc; font-size: 11px; text-transform: uppercase; color: #555; }
  .totals { margin-top: 16px; margin-left: auto; width: 320px; font-size: 13px; }
  .totals .line { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid #111; margin-top: 6px; padding-top: 6px; font-size: 16px; font-weight: 700; }
  .footer { margin-top: 32px; font-size: 11px; color: #888; text-align: center; }
  @media print {
    body { padding: 12px; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="no-print" style="text-align:right;margin-bottom:12px">
    <button onclick="window.print()">Хэвлэх</button>
  </div>

  <h1>${escapeHtml(shopName)}</h1>
  <div class="muted">Нэхэмжлэх / Invoice</div>

  <div class="row">
    <div class="box">
      <h3>Захиалга</h3>
      <div><strong>${escapeHtml(order.order_number)}</strong></div>
      <div class="muted">${date}</div>
      <div class="muted">Төлбөр: ${escapeHtml(order.payment_method || "-")} (${escapeHtml(order.payment_status || "-")})</div>
    </div>
    <div class="box">
      <h3>Үйлчлүүлэгч</h3>
      <div><strong>${escapeHtml(order.customer_name || "-")}</strong></div>
      <div class="muted">${escapeHtml(order.customer_phone || "")}</div>
      <div class="muted">${escapeHtml(order.customer_email || "")}</div>
      ${order.address_text ? `<div class="muted" style="margin-top:4px">${escapeHtml(order.address_text)}</div>` : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Бараа</th>
        <th style="text-align:center">Тоо</th>
        <th style="text-align:right">Нэгж үнэ</th>
        <th style="text-align:right">Дүн</th>
      </tr>
    </thead>
    <tbody>${itemRows || `<tr><td colspan="4" class="muted">Бараа алга</td></tr>`}</tbody>
  </table>

  <div class="totals">
    <div class="line"><span>Дэд дүн</span><span>${fmt(order.subtotal)}</span></div>
    ${order.discount_amount ? `<div class="line"><span>Хөнгөлөлт</span><span>-${fmt(order.discount_amount)}</span></div>` : ""}
    ${order.delivery_fee ? `<div class="line"><span>Хүргэлт</span><span>${fmt(order.delivery_fee)}</span></div>` : ""}
    <div class="line grand"><span>Нийт дүн</span><span>${fmt(order.total)}</span></div>
  </div>

  ${order.notes ? `<div class="box" style="margin-top:16px"><h3>Тэмдэглэл</h3><div>${escapeHtml(order.notes)}</div></div>` : ""}

  <div class="footer">Баярлалаа! · ${escapeHtml(shopName)}</div>

  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
