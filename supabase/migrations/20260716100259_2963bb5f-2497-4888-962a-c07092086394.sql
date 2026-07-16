
-- 1) Role on profiles
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('rider','driver');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'rider';

-- 2) Update handle_new_user trigger fn to read role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'rider')
  )
  ON CONFLICT (id) DO UPDATE
    SET role = COALESCE(EXCLUDED.role, public.profiles.role),
        name = COALESCE(public.profiles.name, EXCLUDED.name);
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 3) Rider verifications table
CREATE TABLE IF NOT EXISTS public.rider_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  id_number text,
  id_document_url text,
  selfie_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.rider_verifications TO authenticated;
GRANT ALL ON public.rider_verifications TO service_role;

ALTER TABLE public.rider_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rv_select_own_or_admin ON public.rider_verifications;
CREATE POLICY rv_select_own_or_admin ON public.rider_verifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS rv_insert_own ON public.rider_verifications;
CREATE POLICY rv_insert_own ON public.rider_verifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS rv_update_own_pending ON public.rider_verifications;
CREATE POLICY rv_update_own_pending ON public.rider_verifications
  FOR UPDATE TO authenticated
  USING (
    (auth.uid() = user_id AND status = 'pending')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (auth.uid() = user_id AND status = 'pending')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Auto-verify profile on approval
CREATE OR REPLACE FUNCTION public.tg_rider_verif_on_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.profiles SET verified = true WHERE id = NEW.user_id;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_rider_verif_decision ON public.rider_verifications;
CREATE TRIGGER tg_rider_verif_decision
  BEFORE UPDATE ON public.rider_verifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_rider_verif_on_decision();

-- 4) Storage policies for rider docs (reuse driver-docs bucket)
-- (bucket already exists; policies already scoped per-user prefix)
