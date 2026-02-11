
-- Add QPay-related columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS qpay_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS qpay_qr_image TEXT,
ADD COLUMN IF NOT EXISTS qpay_urls JSONB,
ADD COLUMN IF NOT EXISTS qpay_payment_id TEXT;

-- Update payment_status to support QPay statuses
-- Current values: pending, paid, failed
-- We keep these as text, no enum change needed
