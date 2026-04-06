## Delivery Sync Integration Plan

### Step 1: Database Migration
Add delivery sync tracking columns to the `orders` table:
- `delivery_sync_status` (text: pending/synced/failed)
- `delivery_sync_error` (text)
- `delivery_attempt_count` (integer)
- `delivery_last_attempt_at` (timestamptz)
- `delivery_external_id` (text)

### Step 2: Store API Key
Add `DELIVERY_API_KEY` secret for the order-intake endpoint.

### Step 3: Edge Function (`delivery-sync`)
Create edge function that:
- Accepts order_id, fetches order + items from DB
- Validates required fields (phone, address, items)
- Maps data to API payload format
- POSTs to `https://vvqbrpuiqzksygpcmrmg.supabase.co/functions/v1/order-intake`
- Updates sync status (synced/failed) with error details
- Supports batch retry of failed orders
- Duplicate protection via `external_order_id = "SHOP-{order.id}"`

### Step 4: Trigger Integration
- In `orderService.ts`: after order creation, invoke delivery-sync edge function (fire-and-forget)
- In checkout flow: after payment confirmation, trigger sync
- In `CreateOrderDialog`: trigger after admin order creation

### Step 5: Admin UI
Add delivery sync status column to DeliveryOperations page:
- Show sync status badge (pending/synced/failed)
- Show error message on hover
- "Retry Sync" button for failed orders
- Bulk retry option for all failed orders
