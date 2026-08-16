ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS device_bound_at timestamptz;