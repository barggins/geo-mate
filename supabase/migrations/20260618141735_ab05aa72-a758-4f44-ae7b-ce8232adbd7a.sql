
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT, phone TEXT, photo_url TEXT, employer TEXT, bio TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.0,
  rating_count INT NOT NULL DEFAULT 0,
  home_address TEXT, work_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE TYPE ride_status AS ENUM ('scheduled','in_progress','completed','cancelled');
CREATE TYPE request_status AS ENUM ('pending','accepted','rejected','cancelled');

CREATE TABLE public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_label TEXT NOT NULL, destination_label TEXT NOT NULL,
  origin GEOGRAPHY(POINT,4326) NOT NULL,
  destination GEOGRAPHY(POINT,4326) NOT NULL,
  route_line GEOGRAPHY(LINESTRING,4326),
  depart_at TIMESTAMPTZ NOT NULL,
  seats_total INT NOT NULL CHECK (seats_total > 0),
  seats_left INT NOT NULL,
  status ride_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  price_per_seat NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rides_route_gix ON public.rides USING GIST (route_line);
CREATE INDEX rides_depart_idx ON public.rides (depart_at);
CREATE INDEX rides_driver_idx ON public.rides (driver_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rides TO authenticated;
GRANT SELECT ON public.rides TO anon;
GRANT ALL ON public.rides TO service_role;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rides_select_all" ON public.rides FOR SELECT USING (true);
CREATE POLICY "rides_insert_driver" ON public.rides FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "rides_update_driver" ON public.rides FOR UPDATE USING (auth.uid() = driver_id);
CREATE POLICY "rides_delete_driver" ON public.rides FOR DELETE USING (auth.uid() = driver_id);

CREATE TABLE public.ride_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pickup_point GEOGRAPHY(POINT,4326), pickup_label TEXT,
  dropoff_point GEOGRAPHY(POINT,4326), dropoff_label TEXT,
  status request_status NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ride_id, rider_id)
);
CREATE INDEX ride_requests_ride_idx ON public.ride_requests (ride_id);
CREATE INDEX ride_requests_rider_idx ON public.ride_requests (rider_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ride_requests TO authenticated;
GRANT ALL ON public.ride_requests TO service_role;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ride_requests_select" ON public.ride_requests FOR SELECT USING (
  auth.uid() = rider_id OR auth.uid() = (SELECT driver_id FROM public.rides WHERE id = ride_id)
);
CREATE POLICY "ride_requests_insert" ON public.ride_requests FOR INSERT WITH CHECK (auth.uid() = rider_id);
CREATE POLICY "ride_requests_update" ON public.ride_requests FOR UPDATE USING (
  auth.uid() = rider_id OR auth.uid() = (SELECT driver_id FROM public.rides WHERE id = ride_id)
);

CREATE TABLE public.locations (
  id BIGSERIAL PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION, speed_kmh DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX locations_ride_time_idx ON public.locations (ride_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations_insert_driver" ON public.locations FOR INSERT WITH CHECK (
  auth.uid() = driver_id AND auth.uid() = (SELECT driver_id FROM public.rides WHERE id = ride_id)
);
CREATE POLICY "locations_select_participants" ON public.locations FOR SELECT USING (
  auth.uid() = driver_id
  OR EXISTS (SELECT 1 FROM public.ride_requests WHERE ride_id = locations.ride_id AND rider_id = auth.uid() AND status = 'accepted')
);

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  from_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ride_id, from_user, to_user)
);
GRANT SELECT, INSERT ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select_all" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_own" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = from_user);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_ride_idx ON public.messages (ride_id, created_at);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_participants" ON public.messages FOR SELECT USING (
  auth.uid() = sender_id
  OR auth.uid() = (SELECT driver_id FROM public.rides WHERE id = ride_id)
  OR EXISTS (SELECT 1 FROM public.ride_requests WHERE ride_id = messages.ride_id AND rider_id = auth.uid())
);
CREATE POLICY "messages_insert_participants" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND (
    auth.uid() = (SELECT driver_id FROM public.rides WHERE id = ride_id)
    OR EXISTS (SELECT 1 FROM public.ride_requests WHERE ride_id = messages.ride_id AND rider_id = auth.uid() AND status = 'accepted')
  )
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, photo_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.search_rides(
  pickup_lat DOUBLE PRECISION, pickup_lng DOUBLE PRECISION,
  dropoff_lat DOUBLE PRECISION, dropoff_lng DOUBLE PRECISION,
  radius_m INT DEFAULT 3000,
  from_time TIMESTAMPTZ DEFAULT now(),
  to_time TIMESTAMPTZ DEFAULT (now() + interval '7 days')
) RETURNS TABLE (
  id UUID, driver_id UUID, origin_label TEXT, destination_label TEXT,
  depart_at TIMESTAMPTZ, seats_left INT, status ride_status,
  price_per_seat NUMERIC, pickup_distance_m DOUBLE PRECISION, dropoff_distance_m DOUBLE PRECISION,
  driver_name TEXT, driver_photo TEXT, driver_rating NUMERIC
) LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT * FROM (
    SELECT r.id, r.driver_id, r.origin_label, r.destination_label, r.depart_at, r.seats_left, r.status,
      r.price_per_seat,
      ST_Distance(COALESCE(r.route_line, ST_MakeLine(r.origin::geometry, r.destination::geometry)::geography),
                  ST_MakePoint(pickup_lng, pickup_lat)::geography)::double precision AS pickup_distance_m,
      ST_Distance(COALESCE(r.route_line, ST_MakeLine(r.origin::geometry, r.destination::geometry)::geography),
                  ST_MakePoint(dropoff_lng, dropoff_lat)::geography)::double precision AS dropoff_distance_m,
      p.name AS driver_name, p.photo_url AS driver_photo, p.rating AS driver_rating
    FROM public.rides r
    JOIN public.profiles p ON p.id = r.driver_id
    WHERE r.status = 'scheduled'
      AND r.seats_left > 0
      AND r.depart_at BETWEEN from_time AND to_time
      AND ST_DWithin(COALESCE(r.route_line, ST_MakeLine(r.origin::geometry, r.destination::geometry)::geography),
                     ST_MakePoint(pickup_lng, pickup_lat)::geography, radius_m)
      AND ST_DWithin(COALESCE(r.route_line, ST_MakeLine(r.origin::geometry, r.destination::geometry)::geography),
                     ST_MakePoint(dropoff_lng, dropoff_lat)::geography, radius_m)
  ) s
  ORDER BY s.depart_at ASC, (s.pickup_distance_m + s.dropoff_distance_m) ASC;
$$;
GRANT EXECUTE ON FUNCTION public.search_rides TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.accept_ride_request(p_request_id UUID)
RETURNS public.ride_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req public.ride_requests; v_ride public.rides;
BEGIN
  SELECT * INTO v_req FROM public.ride_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  SELECT * INTO v_ride FROM public.rides WHERE id = v_req.ride_id FOR UPDATE;
  IF v_ride.driver_id <> auth.uid() THEN RAISE EXCEPTION 'Not the driver'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;
  IF v_ride.seats_left <= 0 THEN RAISE EXCEPTION 'No seats left'; END IF;
  UPDATE public.rides SET seats_left = seats_left - 1 WHERE id = v_ride.id;
  UPDATE public.ride_requests SET status = 'accepted' WHERE id = p_request_id RETURNING * INTO v_req;
  RETURN v_req;
END; $$;
GRANT EXECUTE ON FUNCTION public.accept_ride_request TO authenticated;

CREATE OR REPLACE FUNCTION public.recompute_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET
    rating = COALESCE((SELECT avg(rating)::numeric(3,2) FROM public.reviews WHERE to_user = NEW.to_user), 5.0),
    rating_count = (SELECT count(*) FROM public.reviews WHERE to_user = NEW.to_user)
  WHERE id = NEW.to_user;
  RETURN NEW;
END; $$;
CREATE TRIGGER reviews_recompute_rating AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_rating();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
