ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS months integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payer_note text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reject_reason text;