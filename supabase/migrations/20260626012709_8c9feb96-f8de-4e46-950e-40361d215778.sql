
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, name, photo_url, rating, rating_count, bio, employer, verified, created_at, updated_at)
  ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

CREATE OR REPLACE VIEW public.my_profile_private AS
SELECT id, phone, home_address, work_address
FROM public.profiles
WHERE id = (SELECT auth.uid());
GRANT SELECT ON public.my_profile_private TO authenticated;

CREATE OR REPLACE VIEW public.admin_profiles_full AS
SELECT p.*
FROM public.profiles p
WHERE public.has_role((SELECT auth.uid()), 'admin'::app_role);
GRANT SELECT ON public.admin_profiles_full TO authenticated;

DROP POLICY IF EXISTS lc_realtime_authenticated_topic_access ON realtime.messages;
CREATE POLICY lc_realtime_authenticated_topic_access ON realtime.messages
FOR SELECT TO authenticated
USING (
  (realtime.topic() LIKE 'ride-%' AND EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id::text = substring(realtime.topic() FROM 6)
      AND (r.driver_id = (SELECT auth.uid())
        OR EXISTS (SELECT 1 FROM public.ride_requests rr
                   WHERE rr.ride_id = r.id
                     AND rr.rider_id = (SELECT auth.uid())
                     AND rr.status = 'accepted'::request_status))
  ))
  OR realtime.topic() = ('dash-' || ((SELECT auth.uid()))::text)
  OR realtime.topic() = ('user-locations-' || ((SELECT auth.uid()))::text)
  OR ((realtime.topic() IN ('sos-alerts','rides-log','user-locations-live'))
      AND public.has_role((SELECT auth.uid()), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Users see logs for rides they're in" ON public.ride_log;
CREATE POLICY "Users see logs for rides they're in" ON public.ride_log
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR actor_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_log.ride_id AND r.driver_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.ride_requests rr
             WHERE rr.ride_id = ride_log.ride_id
               AND rr.rider_id = auth.uid()
               AND rr.status = 'accepted'::request_status)
);

DROP POLICY IF EXISTS ride_requests_update ON public.ride_requests;
CREATE POLICY ride_requests_update ON public.ride_requests
FOR UPDATE TO authenticated
USING (auth.uid() = (SELECT rides.driver_id FROM public.rides WHERE rides.id = ride_requests.ride_id))
WITH CHECK (auth.uid() = (SELECT rides.driver_id FROM public.rides WHERE rides.id = ride_requests.ride_id));

DROP POLICY IF EXISTS ride_requests_delete_own ON public.ride_requests;
CREATE POLICY ride_requests_delete_own ON public.ride_requests
FOR DELETE TO authenticated
USING (auth.uid() = rider_id);

ALTER FUNCTION public.has_role(uuid, app_role) SECURITY INVOKER;
ALTER FUNCTION public.accept_ride_request(uuid) SECURITY INVOKER;

DROP FUNCTION IF EXISTS public.claim_first_admin();

REVOKE EXECUTE ON FUNCTION public.log_request_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notify_chat_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notify_ride_request_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notify_ride_request_decision() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_ride_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notify_sos_alert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_notification(uuid, notification_type, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
