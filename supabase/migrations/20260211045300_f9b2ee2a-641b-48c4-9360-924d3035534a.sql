-- Add 'omniway' to the payment_provider enum
ALTER TYPE public.payment_provider ADD VALUE IF NOT EXISTS 'omniway';