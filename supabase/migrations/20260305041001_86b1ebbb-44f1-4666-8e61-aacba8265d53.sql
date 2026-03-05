
CREATE TABLE public.title_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_text text NOT NULL UNIQUE,
  translated_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.title_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read translations"
  ON public.title_translations
  FOR SELECT
  USING (true);
