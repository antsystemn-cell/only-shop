
-- Payment intent status enum
CREATE TYPE public.payment_intent_status AS ENUM (
  'initiated', 'processing', 'paid', 'failed', 'expired'
);

-- Payment intent type enum
CREATE TYPE public.payment_intent_type AS ENUM (
  'order', 'wallet_topup'
);

-- Payment provider enum
CREATE TYPE public.payment_provider AS ENUM (
  'qpay'
);

-- ==========================================
-- Payment Intents (unified payment tracking)
-- ==========================================
CREATE TABLE public.payment_intents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type public.payment_intent_type NOT NULL,
  reference_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  provider public.payment_provider NOT NULL DEFAULT 'qpay',
  status public.payment_intent_status NOT NULL DEFAULT 'initiated',
  invoice_id TEXT,
  qr_image TEXT,
  urls JSONB,
  payment_id TEXT,
  error_message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment intents"
  ON public.payment_intents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payment intents"
  ON public.payment_intents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update payment intents"
  ON public.payment_intents FOR UPDATE
  USING (true);

CREATE INDEX idx_payment_intents_user ON public.payment_intents(user_id);
CREATE INDEX idx_payment_intents_ref ON public.payment_intents(reference_id);
CREATE INDEX idx_payment_intents_invoice ON public.payment_intents(invoice_id);

CREATE TRIGGER update_payment_intents_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- Wallet Top-ups
-- ==========================================
CREATE TABLE public.wallet_topups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topups"
  ON public.wallet_topups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own topups"
  ON public.wallet_topups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update topups"
  ON public.wallet_topups FOR UPDATE
  USING (true);

CREATE TRIGGER update_wallet_topups_updated_at
  BEFORE UPDATE ON public.wallet_topups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- User Wallets
-- ==========================================
CREATE TABLE public.user_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet"
  ON public.user_wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own wallet"
  ON public.user_wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update wallets"
  ON public.user_wallets FOR UPDATE
  USING (true);

CREATE TRIGGER update_user_wallets_updated_at
  BEFORE UPDATE ON public.user_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to ensure wallet exists and credit it
CREATE OR REPLACE FUNCTION public.credit_wallet(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  INSERT INTO public.user_wallets (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = user_wallets.balance + p_amount
  RETURNING balance INTO new_balance;
  RETURN new_balance;
END;
$$;
