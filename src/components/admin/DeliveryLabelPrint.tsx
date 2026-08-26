import { formatCurrency } from "@/lib/orderService";

interface DeliveryLabelPrintProps {
  order: any;
}

/** Shared 70x80mm label markup (styles inlined so it can be reused for print AND html2canvas/PDF). */
export function buildLabelInnerHtml(order: any) {
  const deliveryAddress = order.delivery_address || {};
  const district = deliveryAddress.district || "";
  const addressText = order.address_text || deliveryAddress.street_address || "";
  const phone = order.customer_phone || order.profile?.phone || "";
  const isPaid = order.payment_status === "paid";
  const items = order.order_items || [];

  let itemsHtml = "";
  if (items.length > 0) {
    const displayItems = items.slice(0, 3);
    itemsHtml = displayItems.map((item: any) => {
      const snapshot = item.product_snapshot || {};
      const name = item.product_name_snapshot || snapshot.title || snapshot.name || snapshot.name_mn || "Бараа";
      const shortName = name.length > 30 ? name.substring(0, 28) + "…" : name;
      const qty = item.quantity > 1 ? ` x${item.quantity}` : "";
      const variants = [item.color_snapshot, item.size_snapshot].filter(Boolean).join(", ");
      return `<div style="font-size:8pt;line-height:1.3;margin-bottom:1mm;">• ${shortName}${qty}${variants ? ` (${variants})` : ""}</div>`;
    }).join("");
    if (items.length > 3) {
      itemsHtml += `<div style="font-size:7pt;color:#666;">... +${items.length - 3} бараа</div>`;
    }
  }

  const paymentHtml = !isPaid ? `
    <div style="border:1px dashed #000;padding:2mm;margin-top:2mm;text-align:center;">
      <div style="font-size:8pt;font-weight:bold;margin-bottom:1mm;">Төлбөр: ${formatCurrency(Number(order.total))}</div>
      <div style="font-size:8pt;">Хаан банк</div>
      <div style="font-size:8pt;">Энхбулган</div>
      <div style="font-size:8pt;font-weight:bold;">MN06000500 5307010936</div>
    </div>
  ` : "";

  return `
  ${district ? `<div class="district">${district}</div>` : ""}
  <div class="address">${addressText || "Хаяг оруулаагүй"}</div>
  ${phone ? `<div class="phone">📞 ${phone}</div>` : ""}
  <div class="items">${itemsHtml || '<div style="font-size:8pt;color:#999;">Бараа байхгүй</div>'}</div>
  ${paymentHtml}
  <div class="footer">Манайхаар үйлчлүүлсэн танд баярлалаа.</div>`;
}

/** Shared label CSS (class rules used by buildLabelInnerHtml). */
export const LABEL_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .label {
    width: 70mm;
    height: 80mm;
    padding: 3mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
  }
  .district {
    background: #000;
    color: #fff;
    text-align: center;
    font-weight: bold;
    font-size: 14pt;
    padding: 2mm;
    margin: -3mm -3mm 2mm -3mm;
  }
  .address { font-size: 9pt; line-height: 1.3; margin-bottom: 2mm; word-wrap: break-word; }
  .phone { font-size: 11pt; font-weight: bold; margin-bottom: 2mm; text-align: center; }
  .items {
    flex: 1; min-height: 0; overflow: hidden;
    border-top: 0.5px solid #ccc; padding-top: 1.5mm; margin-bottom: 1.5mm;
  }
  .footer {
    text-align: center; font-size: 6.5pt; color: #555;
    border-top: 0.5px solid #ccc; padding-top: 1mm; margin-top: auto;
  }
`;

export function printDeliveryLabel(order: any) {
  const win = window.open("", "_blank", "width=400,height=500");
  if (!win) return;


  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Label - ${order.order_number}</title>
<style>
  @page {
    size: 70mm 80mm;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 70mm;
    height: 80mm;
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .label {
    width: 70mm;
    height: 80mm;
    padding: 3mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .district {
    background: #000;
    color: #fff;
    text-align: center;
    font-weight: bold;
    font-size: 14pt;
    padding: 2mm;
    margin: -3mm -3mm 2mm -3mm;
  }
  .address {
    font-size: 9pt;
    line-height: 1.3;
    margin-bottom: 2mm;
    word-wrap: break-word;
  }
  .phone {
    font-size: 11pt;
    font-weight: bold;
    margin-bottom: 2mm;
    text-align: center;
  }
  .items {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    border-top: 0.5px solid #ccc;
    padding-top: 1.5mm;
    margin-bottom: 1.5mm;
  }
  .footer {
    text-align: center;
    font-size: 6.5pt;
    color: #555;
    border-top: 0.5px solid #ccc;
    padding-top: 1mm;
    margin-top: auto;
  }
  @media screen {
    body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
    .label { border: 1px solid #ccc; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  }
</style>
</head>
<body>
<div class="label">
  ${district ? `<div class="district">${district}</div>` : ""}
  <div class="address">${addressText || "Хаяг оруулаагүй"}</div>
  ${phone ? `<div class="phone">📞 ${phone}</div>` : ""}
  <div class="items">${itemsHtml || '<div style="font-size:8pt;color:#999;">Бараа байхгүй</div>'}</div>
  ${paymentHtml}
  <div class="footer">Манайхаар үйлчлүүлсэн танд баярлалаа.</div>
</div>
<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 300);
  };
  window.onafterprint = function() { window.close(); };
</script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
