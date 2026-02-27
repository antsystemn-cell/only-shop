
-- Add cancel_reason column to ot_orders
ALTER TABLE public.ot_orders ADD COLUMN cancel_reason text;
