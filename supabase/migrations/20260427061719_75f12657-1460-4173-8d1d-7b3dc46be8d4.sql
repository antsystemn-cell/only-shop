ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS free_delivery_min_qty integer;

COMMENT ON COLUMN public.products.free_delivery_min_qty IS 'Хэрэв энэ тоо хэмжээнээс дээш авбал тухайн барааны хүргэлт үнэгүй болно. NULL бол идэвхгүй.';