
DROP POLICY IF EXISTS reviews_insert_own ON public.reviews;
CREATE POLICY reviews_insert_own ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = from_user
    AND EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = reviews.ride_id
        AND r.status = 'completed'
        AND (
          (to_user = r.driver_id AND EXISTS (
            SELECT 1 FROM public.ride_requests rr
            WHERE rr.ride_id = r.id AND rr.rider_id = auth.uid() AND rr.status = 'accepted'
          ))
          OR
          (from_user = r.driver_id AND EXISTS (
            SELECT 1 FROM public.ride_requests rr
            WHERE rr.ride_id = r.id AND rr.rider_id = to_user AND rr.status = 'accepted'
          ))
        )
    )
  );

DROP POLICY IF EXISTS reviews_select_all ON public.reviews;
CREATE POLICY reviews_select_authenticated ON public.reviews
  FOR SELECT TO authenticated USING (true);

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (name, photo_url, bio, employer, rating, rating_count) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS rides_select_all ON public.rides;
CREATE POLICY rides_select_authenticated ON public.rides
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS user_locations_select_shared ON public.user_locations;
CREATE POLICY user_locations_select_ride_participants ON public.user_locations
  FOR SELECT TO authenticated
  USING (
    sharing = true
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.rides r
        JOIN public.ride_requests rr ON rr.ride_id = r.id
        WHERE rr.status = 'accepted'
          AND (
            (r.driver_id = user_locations.user_id AND rr.rider_id = auth.uid())
            OR
            (rr.rider_id = user_locations.user_id AND r.driver_id = auth.uid())
          )
      )
    )
  );

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_ride_request(uuid) TO authenticated;
