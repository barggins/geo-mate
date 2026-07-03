
DO $$ BEGIN
  CREATE TYPE public.driver_app_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.driver_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  licence_url TEXT,
  vehicle_reg_url TEXT,
  vehicle_photos TEXT[] DEFAULT '{}'::text[],
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INT,
  vehicle_color TEXT,
  vehicle_plate TEXT,
  bank_name TEXT,
  bank_account_holder TEXT,
  bank_account_number TEXT,
  bank_branch_code TEXT,
  status public.driver_app_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.driver_applications TO authenticated;
GRANT ALL ON public.driver_applications TO service_role;

ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_apps_select_own_or_admin" ON public.driver_applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "driver_apps_insert_own" ON public.driver_applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "driver_apps_update_own_while_pending" ON public.driver_applications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "driver_apps_admin_update" ON public.driver_applications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.tg_driver_apps_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_driver_apps_updated_at ON public.driver_applications;
CREATE TRIGGER trg_driver_apps_updated_at
  BEFORE UPDATE ON public.driver_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_driver_apps_updated_at();

CREATE OR REPLACE FUNCTION public.tg_driver_apps_on_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved','rejected') THEN
    NEW.reviewed_by = auth.uid();
    NEW.reviewed_at = now();
    IF NEW.status = 'approved' THEN
      UPDATE public.profiles SET verified = true WHERE id = NEW.user_id;
    ELSIF OLD.status = 'approved' AND NEW.status = 'rejected' THEN
      UPDATE public.profiles SET verified = false WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_driver_apps_on_decision() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_driver_apps_on_decision ON public.driver_applications;
CREATE TRIGGER trg_driver_apps_on_decision
  BEFORE UPDATE OF status ON public.driver_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_driver_apps_on_decision();

-- Storage policies for driver-docs bucket
DROP POLICY IF EXISTS "driver_docs_owner_all" ON storage.objects;
CREATE POLICY "driver_docs_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'driver-docs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'driver-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "driver_docs_admin_read" ON storage.objects;
CREATE POLICY "driver_docs_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'driver-docs' AND public.has_role(auth.uid(), 'admin'::app_role));
