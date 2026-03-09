
-- Amazon Connections
CREATE TABLE public.amazon_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL DEFAULT 'us-east-1',
  marketplace_ids text[] DEFAULT '{}',
  seller_id text,
  is_active boolean DEFAULT true,
  last_token_refresh_at timestamptz,
  last_successful_api_call_at timestamptz,
  auth_status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.amazon_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage amazon_connections" ON public.amazon_connections FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Amazon Marketplaces
CREATE TABLE public.amazon_marketplaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_id text NOT NULL UNIQUE,
  name text NOT NULL,
  region text NOT NULL,
  locale text DEFAULT 'en_US',
  currency text DEFAULT 'USD',
  country_code text,
  endpoint_url text,
  is_enabled boolean DEFAULT false,
  is_default_import boolean DEFAULT false,
  is_default_storefront boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.amazon_marketplaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage amazon_marketplaces" ON public.amazon_marketplaces FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can view enabled amazon_marketplaces" ON public.amazon_marketplaces FOR SELECT USING (is_enabled = true);

-- Seed known marketplaces
INSERT INTO public.amazon_marketplaces (marketplace_id, name, region, locale, currency, country_code, endpoint_url, is_enabled) VALUES
('ATVPDKIKX0DER', 'Amazon.com (US)', 'us-east-1', 'en_US', 'USD', 'US', 'https://sellingpartnerapi-na.amazon.com', true),
('A2EUQ1WTGCTBG2', 'Amazon.ca (Canada)', 'us-east-1', 'en_CA', 'CAD', 'CA', 'https://sellingpartnerapi-na.amazon.com', false),
('A1AM78C64UM0Y8', 'Amazon.com.mx (Mexico)', 'us-east-1', 'es_MX', 'MXN', 'MX', 'https://sellingpartnerapi-na.amazon.com', false),
('A1PA6795UKMFR9', 'Amazon.de (Germany)', 'eu-west-1', 'de_DE', 'EUR', 'DE', 'https://sellingpartnerapi-eu.amazon.com', false),
('A1F83G8C2ARO7P', 'Amazon.co.uk (UK)', 'eu-west-1', 'en_GB', 'GBP', 'GB', 'https://sellingpartnerapi-eu.amazon.com', false),
('A1VC38T7YXB528', 'Amazon.co.jp (Japan)', 'us-west-2', 'ja_JP', 'JPY', 'JP', 'https://sellingpartnerapi-fe.amazon.com', false),
('AAHKV2X7AFYLW', 'Amazon.cn (China)', 'us-west-2', 'zh_CN', 'CNY', 'CN', 'https://sellingpartnerapi-fe.amazon.com', false);

-- Amazon Categories
CREATE TABLE public.amazon_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amazon_category_key text NOT NULL,
  browse_node_id text,
  product_type text,
  name text NOT NULL,
  parent_id uuid REFERENCES public.amazon_categories(id),
  marketplace_id text REFERENCES public.amazon_marketplaces(marketplace_id),
  raw_payload jsonb DEFAULT '{}',
  product_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  is_hidden boolean DEFAULT false,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(amazon_category_key, marketplace_id)
);

ALTER TABLE public.amazon_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage amazon_categories" ON public.amazon_categories FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can view active amazon_categories" ON public.amazon_categories FOR SELECT USING (is_active = true AND is_hidden = false);

-- Amazon Category Mappings
CREATE TABLE public.amazon_category_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amazon_category_id uuid NOT NULL REFERENCES public.amazon_categories(id) ON DELETE CASCADE,
  local_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  mapping_type text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(amazon_category_id)
);

ALTER TABLE public.amazon_category_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage amazon_category_mappings" ON public.amazon_category_mappings FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can read amazon_category_mappings" ON public.amazon_category_mappings FOR SELECT USING (true);

-- Amazon Products
CREATE TABLE public.amazon_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asin text NOT NULL,
  marketplace_id text NOT NULL REFERENCES public.amazon_marketplaces(marketplace_id),
  title text,
  brand text,
  short_description text,
  full_description text,
  main_image text,
  image_gallery jsonb DEFAULT '[]',
  attributes jsonb DEFAULT '{}',
  dimensions jsonb DEFAULT '{}',
  identifiers jsonb DEFAULT '{}',
  relationships jsonb DEFAULT '[]',
  browse_classifications jsonb DEFAULT '[]',
  raw_payload jsonb DEFAULT '{}',
  source_price numeric,
  source_currency text,
  source_status text DEFAULT 'active',
  amazon_category_id uuid REFERENCES public.amazon_categories(id),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asin, marketplace_id)
);

ALTER TABLE public.amazon_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage amazon_products" ON public.amazon_products FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can view active amazon_products" ON public.amazon_products FOR SELECT USING (source_status = 'active');

-- Amazon Product Store Settings (admin overrides)
CREATE TABLE public.amazon_product_store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amazon_product_id uuid NOT NULL REFERENCES public.amazon_products(id) ON DELETE CASCADE UNIQUE,
  local_slug text,
  local_title_override text,
  local_description_override text,
  local_meta_title text,
  local_meta_description text,
  publish_status text DEFAULT 'draft',
  visibility_status text DEFAULT 'visible',
  pricing_rule_id uuid,
  manual_price_override numeric,
  featured_sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.amazon_product_store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage amazon_product_store_settings" ON public.amazon_product_store_settings FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can read published amazon_product_store_settings" ON public.amazon_product_store_settings FOR SELECT USING (publish_status = 'published');

-- Amazon Sync Jobs
CREATE TABLE public.amazon_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  status text DEFAULT 'pending',
  payload jsonb DEFAULT '{}',
  result jsonb DEFAULT '{}',
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.amazon_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage amazon_sync_jobs" ON public.amazon_sync_jobs FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Amazon API Logs
CREATE TABLE public.amazon_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_name text NOT NULL,
  marketplace_id text,
  request_summary jsonb DEFAULT '{}',
  response_code integer,
  rate_limit_header text,
  status text DEFAULT 'success',
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.amazon_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage amazon_api_logs" ON public.amazon_api_logs FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Amazon Pricing Rules
CREATE TABLE public.amazon_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text DEFAULT 'amazon',
  marketplace_id text REFERENCES public.amazon_marketplaces(marketplace_id),
  category_id uuid REFERENCES public.amazon_categories(id),
  brand text,
  formula_type text NOT NULL DEFAULT 'percentage_markup',
  formula_value numeric NOT NULL DEFAULT 0,
  min_margin numeric DEFAULT 0,
  rounding_rule text DEFAULT 'round_up_100',
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.amazon_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage amazon_pricing_rules" ON public.amazon_pricing_rules FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can read active amazon_pricing_rules" ON public.amazon_pricing_rules FOR SELECT USING (is_active = true);

-- Enable realtime for sync jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.amazon_sync_jobs;
