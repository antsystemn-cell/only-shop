
-- Migration jobs tracking table
CREATE TABLE public.migration_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type text NOT NULL, -- 'users', 'orders', 'wallets', 'addresses'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  total_count integer DEFAULT 0,
  processed_count integer DEFAULT 0,
  success_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  params jsonb DEFAULT '{}'::jsonb,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.migration_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage migration jobs"
  ON public.migration_jobs FOR ALL
  USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_migration_jobs_updated_at
  BEFORE UPDATE ON public.migration_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
