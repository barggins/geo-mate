
-- Block non-admins from changing profiles.verified
CREATE OR REPLACE FUNCTION public.prevent_self_verify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.verified IS DISTINCT FROM OLD.verified
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change verified status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_verify ON public.profiles;
CREATE TRIGGER trg_prevent_self_verify
  BEFORE UPDATE OF verified ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_verify();
