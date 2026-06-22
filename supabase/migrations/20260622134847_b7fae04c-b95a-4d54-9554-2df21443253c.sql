
-- profiles
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.profiles FROM anon;

-- messages
DROP POLICY IF EXISTS "messages_select_participants" ON public.messages;
CREATE POLICY "messages_select_participants"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = (SELECT rides.driver_id FROM public.rides WHERE rides.id = messages.ride_id)
    OR EXISTS (
      SELECT 1 FROM public.ride_requests
      WHERE ride_requests.ride_id = messages.ride_id
        AND ride_requests.rider_id = auth.uid()
        AND ride_requests.status = 'accepted'::request_status
    )
  );

-- ride_log
DROP POLICY IF EXISTS "Anyone authenticated can append log" ON public.ride_log;
CREATE POLICY "Ride participants can append log"
  ON public.ride_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (actor_id = auth.uid() OR actor_id IS NULL)
    AND (
      EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_log.ride_id AND r.driver_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.ride_requests rr
        WHERE rr.ride_id = ride_log.ride_id
          AND rr.rider_id = auth.uid()
          AND rr.status = 'accepted'::request_status
      )
    )
  );

-- SECURITY DEFINER function execute privileges
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.accept_ride_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_ride_request(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.log_ride_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_request_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_rating() FROM PUBLIC, anon, authenticated;

-- Realtime channel authorization
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lc_realtime_authenticated_topic_access" ON realtime.messages;
CREATE POLICY "lc_realtime_authenticated_topic_access"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    (
      realtime.topic() LIKE 'ride-%'
      AND EXISTS (
        SELECT 1 FROM public.rides r
        WHERE r.id::text = substring(realtime.topic() FROM 6)
          AND (
            r.driver_id = (SELECT auth.uid())
            OR EXISTS (
              SELECT 1 FROM public.ride_requests rr
              WHERE rr.ride_id = r.id
                AND rr.rider_id = (SELECT auth.uid())
                AND rr.status = 'accepted'::request_status
            )
          )
      )
    )
    OR realtime.topic() = 'dash-' || (SELECT auth.uid())::text
    OR realtime.topic() = 'user-locations-live'
    OR realtime.topic() = 'sos-alerts'
    OR realtime.topic() = 'rides-log'
  );
