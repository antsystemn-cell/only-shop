
-- Fix overly permissive UPDATE policies by restricting to authenticated users updating own records
-- (Edge function uses service_role key which bypasses RLS anyway)

DROP POLICY "Service role can update payment intents" ON public.payment_intents;
CREATE POLICY "Users can update own payment intents"
  ON public.payment_intents FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY "Service role can update topups" ON public.wallet_topups;
CREATE POLICY "Users can update own topups"
  ON public.wallet_topups FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY "Service role can update wallets" ON public.user_wallets;
CREATE POLICY "Users can update own wallet"
  ON public.user_wallets FOR UPDATE
  USING (auth.uid() = user_id);
