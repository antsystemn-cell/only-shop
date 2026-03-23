CREATE OR REPLACE FUNCTION public.credit_wallet(p_user_id uuid, p_amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_bal NUMERIC;
  new_balance NUMERIC;
BEGIN
  IF p_amount < 0 THEN
    SELECT balance INTO current_bal FROM public.user_wallets WHERE user_id = p_user_id;
    IF current_bal IS NULL OR (current_bal + p_amount) < 0 THEN
      RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;
  END IF;

  INSERT INTO public.user_wallets (user_id, balance)
  VALUES (p_user_id, GREATEST(p_amount, 0))
  ON CONFLICT (user_id) DO UPDATE SET balance = user_wallets.balance + p_amount
  RETURNING balance INTO new_balance;
  RETURN new_balance;
END;
$function$;