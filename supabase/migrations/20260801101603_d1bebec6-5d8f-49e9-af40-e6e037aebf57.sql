CREATE TYPE public.vehicle_kind AS ENUM ('car','van','bus','taxi');
CREATE TYPE public.group_member_role AS ENUM ('member','driver');

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  vehicle_type public.vehicle_kind NOT NULL DEFAULT 'car',
  origin_label text NOT NULL,
  origin_lat double precision NOT NULL,
  origin_lng double precision NOT NULL,
  destination_label text NOT NULL,
  destination_lat double precision NOT NULL,
  destination_lng double precision NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_approved_driver(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.driver_applications d WHERE d.user_id = _uid AND d.status = 'approved');
$$;
REVOKE EXECUTE ON FUNCTION public.is_approved_driver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_driver(uuid) TO authenticated;

CREATE POLICY "groups_select_auth" ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "groups_insert_driver_or_admin" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.is_approved_driver(auth.uid())));
CREATE POLICY "groups_update_owner_or_admin" ON public.groups FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "groups_delete_owner_or_admin" ON public.groups FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.group_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX group_stops_group_idx ON public.group_stops(group_id, seq);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_stops TO authenticated;
GRANT ALL ON public.group_stops TO service_role;
ALTER TABLE public.group_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_stops_select_auth" ON public.group_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_stops_write_owner_or_admin" ON public.group_stops FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role public.group_member_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_members_select_auth" ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_members_join_self" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "group_members_leave_self_or_admin" ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
         OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid()));

ALTER TABLE public.rides
  ADD COLUMN group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  ADD COLUMN vehicle_type public.vehicle_kind NOT NULL DEFAULT 'car',
  ADD COLUMN is_full boolean NOT NULL DEFAULT false;
CREATE INDEX rides_group_idx ON public.rides(group_id);

CREATE OR REPLACE FUNCTION public.tg_rides_auto_full()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.seats_left <= 0 THEN
    NEW.is_full := true;
  ELSIF TG_OP = 'UPDATE' AND NEW.seats_left > 0 AND OLD.seats_left <= 0 THEN
    NEW.is_full := false;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_rides_auto_full BEFORE INSERT OR UPDATE OF seats_left ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.tg_rides_auto_full();

CREATE TRIGGER groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER group_stops_updated_at BEFORE UPDATE ON public.group_stops FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER group_members_updated_at BEFORE UPDATE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();