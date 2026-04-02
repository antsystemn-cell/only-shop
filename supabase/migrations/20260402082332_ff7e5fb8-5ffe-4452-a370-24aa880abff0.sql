
ALTER TABLE public.products
ADD COLUMN delivery_fee_type text NOT NULL DEFAULT 'default',
ADD COLUMN custom_delivery_fee numeric DEFAULT NULL;

COMMENT ON COLUMN public.products.delivery_fee_type IS 'Delivery fee policy: default (site zones), free (no fee), custom (fixed fee)';
COMMENT ON COLUMN public.products.custom_delivery_fee IS 'Custom delivery fee amount when delivery_fee_type is custom';
