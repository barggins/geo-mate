-- 1) Server-side enforcement of the unverified-rider active booking limit
CREATE OR REPLACE FUNCTION public.enforce_rider_booking_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verified boolean;
  v_active integer;
BEGIN
  IF NEW.status NOT IN ('pending','accepted') THEN
    RETURN NEW;
  END IF;

  SELECT verified INTO v_verified FROM public.profiles WHERE id = NEW.rider_id;

  IF COALESCE(v_verified, false) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_active
  FROM public.ride_requests
  WHERE rider_id = NEW.rider_id
    AND status IN ('pending','accepted')
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_active >= 1 THEN
    RAISE EXCEPTION 'Unverified riders can hold only 1 active booking at a time. Verify your identity to book more rides.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_rider_booking_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_rider_booking_limit ON public.ride_requests;
CREATE TRIGGER trg_rider_booking_limit
BEFORE INSERT OR UPDATE OF status ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_rider_booking_limit();

-- 2) Public (anonymous) browse access for listings only
GRANT SELECT ON public.rides TO anon;
GRANT SELECT ON public.groups TO anon;
GRANT SELECT ON public.group_stops TO anon;

DROP POLICY IF EXISTS "rides_public_browse" ON public.rides;
CREATE POLICY "rides_public_browse" ON public.rides
FOR SELECT TO anon
USING (status = 'scheduled' AND depart_at > (now() - interval '2 hours'));

DROP POLICY IF EXISTS "groups_public_browse" ON public.groups;
CREATE POLICY "groups_public_browse" ON public.groups
FOR SELECT TO anon
USING (is_public = true);

DROP POLICY IF EXISTS "group_stops_public_browse" ON public.group_stops;
CREATE POLICY "group_stops_public_browse" ON public.group_stops
FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.is_public = true));