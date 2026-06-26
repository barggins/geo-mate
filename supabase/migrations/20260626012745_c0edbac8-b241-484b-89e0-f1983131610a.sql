
-- Drop previously created views
DROP VIEW IF EXISTS public.my_profile_private;
DROP VIEW IF EXISTS public.admin_profiles_full;

-- Create private table
CREATE TABLE IF NOT EXISTS public.profile_private (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  home_address text,
  work_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_private TO authenticated;
GRANT ALL ON public.profile_private TO service_role;

ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_private_select_own_or_admin ON public.profile_private
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY profile_private_insert_own ON public.profile_private
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY profile_private_update_own ON public.profile_private
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER profile_private_updated_at BEFORE UPDATE ON public.profile_private
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Backfill from existing profiles
INSERT INTO public.profile_private (user_id, phone, home_address, work_address)
SELECT id, phone, home_address, work_address
FROM public.profiles
WHERE phone IS NOT NULL OR home_address IS NOT NULL OR work_address IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Drop sensitive columns from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS home_address;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS work_address;

-- Restore standard SELECT grant (no sensitive cols remain)
GRANT SELECT ON public.profiles TO authenticated;
