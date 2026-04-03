
# Unified Order Management & Delivery Operations System

## Phase 1: Database Schema Extension
**Migration to extend orders system with new fields and tables:**

### A. Extend `orders` table:
- `source` (text, default 'website') — order channel
- `customer_name`, `customer_phone`, `alternate_phone`, `customer_email` — customer info for manual orders
- `fulfillment_status` (text, default 'confirmed') — separate from payment_status
- `address_text`, `delivery_note`, `map_lat`, `map_lng` — delivery details
- `discount_amount` (numeric, default 0)
- `internal_note` (text) — admin-only note
- `affects_inventory` (boolean, default true)
- `inventory_applied_at`, `confirmed_at`, `cancelled_at`, `delivered_at` — timestamps
- `created_by_user_id`, `assigned_to_user_id`, `updated_by_user_id` — staff tracking

### B. Extend `order_items` table:
- `variant_id`, `product_name_snapshot`, `sku_snapshot`, `variant_name_snapshot`, `color_snapshot`, `size_snapshot`, `line_total`

### C. New `order_status_logs` table:
- Tracks every status change with who/when/note

### D. New `inventory_adjustments` table:
- Tracks stock changes tied to orders

### E. Extend `app_role` enum:
- Add `order_staff` role

### F. New `role_permissions` table:
- Granular permission control per role

## Phase 2: Admin Orders Page Rebuild
- Add filters: source, payment status, fulfillment status, date range, assigned staff
- Add search by order number, phone, customer name
- Add "Create Order" button opening manual order form
- Show new columns: source, fulfillment status, assigned to

## Phase 3: Manual Order Creation Form
- Customer info (name, phone, email, source)
- Product search & selection with variant support
- Delivery address
- Payment method & status
- Save as draft or confirm
- Customer lookup by phone

## Phase 4: /delivery Operational Page
- Summary cards (new, preparing, ready, out, delivered today, COD unpaid)
- Kanban-style grouped view by fulfillment status
- Quick actions for status transitions
- Filters for date, source, status, assignment

## Phase 5: Order Detail Panel
- Full order info display
- Status history log
- Quick status update actions
- Internal notes

## Phase 6: Inventory Logic
- Centralized service for stock adjustments
- Draft = no stock effect
- Confirmed+ = stock deducted
- Cancelled = stock restored
- Legacy import option: affects_inventory = false

## Phase 7: Role & Permission System
- order_staff role
- Permission-based access control
- Admin UI for role assignment
- /delivery page access control

## Phase 8: Reporting Extension
- Orders by source/channel
- Website vs manual breakdown
- Staff performance metrics

---

**Implementation order:** Database → Services → Admin Orders → Manual Order Form → Delivery Page → Permissions → Reporting
