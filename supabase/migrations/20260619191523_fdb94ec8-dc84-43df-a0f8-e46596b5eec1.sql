
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view & update all profiles (for verification)
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update verification" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ride log (audit trail)
CREATE TABLE public.ride_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ride_log_ride_id_idx ON public.ride_log(ride_id);
CREATE INDEX ride_log_created_at_idx ON public.ride_log(created_at DESC);

GRANT SELECT, INSERT ON public.ride_log TO authenticated;
GRANT ALL ON public.ride_log TO service_role;

ALTER TABLE public.ride_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see logs for rides they're in" ON public.ride_log
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR actor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND r.driver_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.ride_requests rr WHERE rr.ride_id = ride_log.ride_id AND rr.rider_id = auth.uid())
  );

CREATE POLICY "Anyone authenticated can append log" ON public.ride_log
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- Auto-log ride lifecycle changes
CREATE OR REPLACE FUNCTION public.log_ride_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ride_log(ride_id, actor_id, event, details)
    VALUES (NEW.id, NEW.driver_id, 'ride_created',
      jsonb_build_object('origin', NEW.origin_label, 'destination', NEW.destination_label, 'depart_at', NEW.depart_at));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ride_log(ride_id, actor_id, event, details)
    VALUES (NEW.id, NEW.driver_id, 'status_' || NEW.status,
      jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER rides_log_trg
AFTER INSERT OR UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.log_ride_event();

CREATE OR REPLACE FUNCTION public.log_request_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ride_log(ride_id, actor_id, event, details)
    VALUES (NEW.ride_id, NEW.rider_id, 'request_created', jsonb_build_object('request_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ride_log(ride_id, actor_id, event, details)
    VALUES (NEW.ride_id, NEW.rider_id, 'request_' || NEW.status,
      jsonb_build_object('request_id', NEW.id, 'from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER ride_requests_log_trg
AFTER INSERT OR UPDATE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.log_request_event();
