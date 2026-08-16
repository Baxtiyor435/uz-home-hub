ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS promoted_until timestamptz;
CREATE INDEX IF NOT EXISTS properties_promoted_until_idx ON public.properties (promoted_until DESC NULLS LAST);
ALTER TYPE payment_purpose ADD VALUE IF NOT EXISTS 'promotion';