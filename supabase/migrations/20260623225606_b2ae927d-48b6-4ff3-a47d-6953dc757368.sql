-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'ride_request', 'request_accepted', 'request_rejected',
    'sos_alert', 'chat_message', 'ride_cancelled', 'ride_started', 'ride_completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM ('in_app', 'push', 'sms', 'whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  data jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  delivered_push boolean NOT NULL DEFAULT false,
  delivered_sms boolean NOT NULL DEFAULT false,
  delivered_whatsapp boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, read_at, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ PREFS ============
CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  phone_e164 text,
  events_ride_request boolean NOT NULL DEFAULT true,
  events_request_decision boolean NOT NULL DEFAULT true,
  events_sos boolean NOT NULL DEFAULT true,
  events_chat boolean NOT NULL DEFAULT true,
  events_ride_status boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prefs_select_own ON public.notification_prefs;
CREATE POLICY prefs_select_own ON public.notification_prefs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS prefs_upsert_own ON public.notification_prefs;
CREATE POLICY prefs_upsert_own ON public.notification_prefs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS prefs_update_own ON public.notification_prefs;
CREATE POLICY prefs_update_own ON public.notification_prefs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ DEVICE TOKENS (FCM) ============
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON public.device_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_tokens_own ON public.device_tokens;
CREATE POLICY device_tokens_own ON public.device_tokens
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ HELPER: enqueue notification ============
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_user uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_link text,
  p_data jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prefs public.notification_prefs%ROWTYPE;
  v_id uuid;
  v_event_enabled boolean := true;
BEGIN
  SELECT * INTO v_prefs FROM public.notification_prefs WHERE user_id = p_user;

  IF FOUND THEN
    v_event_enabled := CASE p_type
      WHEN 'ride_request' THEN v_prefs.events_ride_request
      WHEN 'request_accepted' THEN v_prefs.events_request_decision
      WHEN 'request_rejected' THEN v_prefs.events_request_decision
      WHEN 'sos_alert' THEN v_prefs.events_sos
      WHEN 'chat_message' THEN v_prefs.events_chat
      ELSE v_prefs.events_ride_status
    END;
    IF NOT v_event_enabled OR NOT v_prefs.in_app_enabled THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, data)
  VALUES (p_user, p_type, p_title, p_body, p_link, COALESCE(p_data, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.enqueue_notification(uuid, public.notification_type, text, text, text, jsonb) FROM PUBLIC;

-- ============ TRIGGERS ============
-- ride_requests: insert -> notify driver
CREATE OR REPLACE FUNCTION public.tg_notify_ride_request_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_driver uuid; v_rider_name text;
BEGIN
  SELECT driver_id INTO v_driver FROM public.rides WHERE id = NEW.ride_id;
  SELECT COALESCE(name,'A rider') INTO v_rider_name FROM public.profiles WHERE id = NEW.rider_id;
  PERFORM public.enqueue_notification(
    v_driver, 'ride_request',
    'New ride request',
    v_rider_name || ' wants to join your ride.',
    '/ride/' || NEW.ride_id::text,
    jsonb_build_object('request_id', NEW.id, 'ride_id', NEW.ride_id)
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_ride_request_insert ON public.ride_requests;
CREATE TRIGGER trg_notify_ride_request_insert
AFTER INSERT ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_ride_request_insert();

-- ride_requests: status change -> notify rider
CREATE OR REPLACE FUNCTION public.tg_notify_ride_request_decision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'accepted' THEN
    PERFORM public.enqueue_notification(
      NEW.rider_id, 'request_accepted',
      'Request accepted 🎉', 'Your seat is confirmed.',
      '/ride/' || NEW.ride_id::text,
      jsonb_build_object('request_id', NEW.id, 'ride_id', NEW.ride_id));
  ELSIF NEW.status = 'rejected' THEN
    PERFORM public.enqueue_notification(
      NEW.rider_id, 'request_rejected',
      'Request declined', 'The driver could not accept your request.',
      '/search',
      jsonb_build_object('request_id', NEW.id, 'ride_id', NEW.ride_id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_ride_request_decision ON public.ride_requests;
CREATE TRIGGER trg_notify_ride_request_decision
AFTER UPDATE OF status ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_ride_request_decision();

-- messages: notify the other participant(s)
CREATE OR REPLACE FUNCTION public.tg_notify_chat_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_sender_name text; v_preview text;
BEGIN
  SELECT COALESCE(name,'Someone') INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  v_preview := left(COALESCE(NEW.body,''), 80);

  -- driver
  FOR r IN SELECT driver_id AS uid FROM public.rides WHERE id = NEW.ride_id AND driver_id <> NEW.sender_id LOOP
    PERFORM public.enqueue_notification(
      r.uid, 'chat_message',
      'New message from ' || v_sender_name, v_preview,
      '/ride/' || NEW.ride_id::text,
      jsonb_build_object('ride_id', NEW.ride_id));
  END LOOP;
  -- accepted riders
  FOR r IN
    SELECT rider_id AS uid FROM public.ride_requests
    WHERE ride_id = NEW.ride_id AND status = 'accepted' AND rider_id <> NEW.sender_id
  LOOP
    PERFORM public.enqueue_notification(
      r.uid, 'chat_message',
      'New message from ' || v_sender_name, v_preview,
      '/ride/' || NEW.ride_id::text,
      jsonb_build_object('ride_id', NEW.ride_id));
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_chat_message ON public.messages;
CREATE TRIGGER trg_notify_chat_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_chat_message();

-- SOS: notify all admins
CREATE OR REPLACE FUNCTION public.tg_notify_sos_alert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.enqueue_notification(
      r.user_id, 'sos_alert',
      '🚨 SOS alert', 'A user has triggered an emergency alert.',
      '/admin',
      jsonb_build_object('sos_id', NEW.id, 'lat', NEW.lat, 'lng', NEW.lng));
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_sos_alert ON public.sos_alerts;
CREATE TRIGGER trg_notify_sos_alert
AFTER INSERT ON public.sos_alerts
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_sos_alert();

-- ============ REALTIME ============
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
