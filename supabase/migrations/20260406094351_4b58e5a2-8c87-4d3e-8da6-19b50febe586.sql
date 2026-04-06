-- Add delivery sync tracking columns to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_sync_error text,
  ADD COLUMN IF NOT EXISTS delivery_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_last_attempt_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS delivery_external_id text;

-- Index for finding orders that need sync
CREATE INDEX IF NOT EXISTS idx_orders_delivery_sync_status ON public.orders (delivery_sync_status) WHERE delivery_sync_status IN ('pending', 'failed');