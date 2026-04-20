# Only Shop / EasyShop — Admin Operations Dashboard Upgrade Plan

## 0. Гол зарчим
- **Backward compatible**: Одоогийн `orders` хүснэгт, website checkout, QPay/OmniWay/Storepay, delivery sync — БҮГД хэвээр ажиллана.
- **Single source of truth**: Бүх sales (website + manual + historical) `orders`-д хадгалагдана. `source_type` болон flag багануудаар ялгана.
- **Delivery API safety**: Manual + historical sales-ийг `delivery_sync_status='disabled'` болгож delivery API-руу автоматаар явуулахгүй. Зөвхөн админ "Create delivery now" дарвал явна.
- **Atomic & idempotent**: Sale үүсгэх + stock хасах + ledger бичих нь нэг RPC дотор transactional.
- **No duplicate counting**: Cancelled sales revenue-д орохгүй. Stock-only adjustments revenue-д орохгүй.

---

## 1. Database changes (1 migration)

### 1.1 `orders` өргөтгөл
```
source_type            text DEFAULT 'website_order'
                       -- website_order | admin_manual_sale | historical_sale
                       -- | phone_order | facebook_chat_order | walk_in_store_sale | other_manual
should_create_delivery boolean DEFAULT true
delivery_creation_mode text DEFAULT 'auto'  -- auto | manual | none
affects_analytics      boolean DEFAULT true
affects_revenue        boolean DEFAULT true
is_historical          boolean DEFAULT false
is_manual              boolean DEFAULT false
sale_date              timestamptz DEFAULT now()
cost_amount            numeric DEFAULT 0
estimated_profit       numeric DEFAULT 0
internal_tags          text[] DEFAULT '{}'
```
Backfill: бүх одоогийн мөрд `source_type='website_order'`, `sale_date=created_at`.

### 1.2 `order_items` өргөтгөл
```
unit_cost numeric DEFAULT 0
line_cost numeric DEFAULT 0
```

### 1.3 Шинэ хүснэгт `stock_movements`
movement_type: restock | manual_adjust | sale_deduction | website_order_deduction | historical_deduction | return_to_stock | damaged_lost | cancellation_restore.
Талбар: product_id, variant_id, quantity_before, quantity_change, quantity_after, reference_type, reference_id, reason, note, created_by_user_id.

### 1.4 Шинэ хүснэгт `expenses`
expense_date, category, amount, payment_method, note, attachment_url, created_by_user_id.

### 1.5 Inventory settings (admin_settings, category='inventory')
allow_negative_stock (bool, false), default_low_stock_threshold (int, 5).

### 1.6 RPC `create_manual_sale(...)` — transactional
1) orders insert (flags + sale_date)
2) order_items insert
3) affects_inventory=true → stock хасах + stock_movements бичих
4) should_create_delivery=false → delivery_sync_status='disabled'
5) allow_negative_stock=false үед stock<qty бол EXCEPTION

### 1.7 RPC `find_potential_duplicate_sale(...)`
phone + date±1 + amount±0.01 + products матч.

---

## 2. Файл бүтэц

### Pages
- admin/Dashboard.tsx (REBUILD)
- admin/sales/SalesIndex.tsx
- admin/sales/ManualSaleEntry.tsx
- admin/sales/HistoricalImport.tsx
- admin/inventory/InventoryOverview.tsx
- admin/inventory/StockMovements.tsx
- admin/Expenses.tsx
- admin/Reports.tsx

### Components
- dashboard: StatsCard, KpiBlock, RevenueChart, SourceBreakdownChart, TopProductsTable, DateRangeFilter, LowStockAlert
- sales: SaleSourceBadge, DeliveryStatusBadge, ProductSearchPicker, SaleItemsEditor, DuplicateWarningDialog
- inventory: StockAdjustmentDialog, RestockDialog, MovementTypeBadge
- expenses: ExpenseFormDialog

### Service layer
- lib/sales/salesService.ts
- lib/sales/historicalImport.ts
- lib/inventory/stockService.ts
- lib/expenses/expensesService.ts
- lib/analytics/dashboardQueries.ts

### Засвар
- App.tsx — шинэ routes
- AdminSidebar.tsx — шинэ menu
- Orders.tsx → SalesIndex рүү merge
- supabase/functions/delivery-sync — guard
- lib/orderService.ts — website checkout default flag-ууд

---

## 3. Sales source matrix

| source_type | should_create_delivery | affects_inventory | revenue | is_manual | is_historical |
|---|---|---|---|---|---|
| website_order | true (auto) | true | true | false | false |
| admin_manual_sale / phone / facebook / walk_in | false (manual opt) | true | true | true | false |
| historical_sale | false (locked) | configurable | true | true | true |

---

## 4. Delivery API protection (multi-layer)
1. Frontend: manual default off; historical hidden.
2. DB: should_create_delivery=false → delivery_sync_status='disabled'.
3. Edge function: эхний шалгалт skip.
4. Manual trigger button: "Create delivery now".

---

## 5. Phases
- **A — Foundation**: migration + service layer + edge guards + backfill source_type.
- **B — Manual & Historical UI**: ProductSearchPicker, ManualSaleEntry, HistoricalImport, SalesIndex.
- **C — Inventory**: Overview, StockMovements, Restock/Adjust dialogs.
- **D — Dashboard + Expenses + Reports**: rebuild dashboard, Expenses CRUD, Reports CSV.
- **E — Polish**: audit log, invoice print, permissions.

---

## 6. Test checklist
- Website order delivery sync хэвээр
- Manual sale → stock↓, ledger, NO delivery API
- Historical (deduct) → stock↓, analytics↑, NO delivery API
- Historical (analytics-only) → stock unchanged, revenue↑
- CSV duplicate → warning (skip/import/mark)
- Cancel → stock restore, revenue↓
- Refund → revenue↓, optional stock restore
- Manual delivery trigger → sync runs once
- Negative stock guard
- Dashboard KPI: Website/Manual/Historical/Expenses/Net
- Date filter cascades
- Low stock threshold alert
- Movement ledger filters (type/date/product)
