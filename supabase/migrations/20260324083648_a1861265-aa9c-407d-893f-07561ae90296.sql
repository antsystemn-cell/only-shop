
CREATE TABLE public.otapi_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method text NOT NULL,
  provider text DEFAULT 'otapi',
  params_hash text,
  page_source text,
  user_id uuid,
  session_id text,
  response_time_ms integer,
  error_code text,
  is_paid boolean DEFAULT false,
  is_cache_hit boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_otapi_logs_created_at ON public.otapi_logs (created_at DESC);
CREATE INDEX idx_otapi_logs_method ON public.otapi_logs (method);
CREATE INDEX idx_otapi_logs_is_paid ON public.otapi_logs (is_paid);

ALTER TABLE public.otapi_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage otapi_logs" ON public.otapi_logs
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Edge functions can insert logs" ON public.otapi_logs
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anyone can read otapi_logs" ON public.otapi_logs
  FOR SELECT TO anon USING (true);
