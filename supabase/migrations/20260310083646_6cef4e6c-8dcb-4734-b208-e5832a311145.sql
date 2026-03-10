
-- Create otp_codes table for OTP verification
CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  purpose text NOT NULL DEFAULT 'login',
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Create sms_logs table for SMS tracking
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'otp',
  to_phone text NOT NULL,
  message text NOT NULL,
  provider_status text,
  provider_response jsonb DEFAULT '{}'::jsonb,
  success boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sms_logs" ON public.sms_logs
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read sms_logs" ON public.sms_logs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_otp_codes_phone_purpose ON public.otp_codes (phone_number, purpose, created_at DESC);
CREATE INDEX idx_otp_codes_expires ON public.otp_codes (expires_at);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone);
CREATE INDEX idx_sms_logs_created ON public.sms_logs (created_at DESC);
