-- Favourite vendors table
CREATE TABLE public.favourite_vendors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  vendor_id text NOT NULL,
  vendor_name text,
  vendor_score numeric,
  vendor_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint
ALTER TABLE public.favourite_vendors ADD CONSTRAINT unique_user_vendor UNIQUE (user_id, vendor_id);

-- RLS
ALTER TABLE public.favourite_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favourite vendors"
  ON public.favourite_vendors FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can add favourite vendors"
  ON public.favourite_vendors FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove favourite vendors"
  ON public.favourite_vendors FOR DELETE
  USING (user_id = auth.uid());

-- Support tickets table
CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
  ON public.support_tickets FOR SELECT
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Users can create tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own open tickets"
  ON public.support_tickets FOR UPDATE
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

-- Support ticket messages
CREATE TABLE public.support_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for own tickets"
  ON public.support_messages FOR SELECT
  USING (
    ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = auth.uid())
    OR is_admin(auth.uid())
  );

CREATE POLICY "Users can add messages to own tickets"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND (
      ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = auth.uid())
      OR is_admin(auth.uid())
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_favourite_vendors_user_id ON public.favourite_vendors(user_id);
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_messages_ticket_id ON public.support_messages(ticket_id);