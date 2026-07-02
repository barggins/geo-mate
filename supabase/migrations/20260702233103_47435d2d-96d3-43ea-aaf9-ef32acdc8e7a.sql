
-- Widen default search window so recently posted rides and rides up to 30 days out show up
CREATE OR REPLACE FUNCTION public.search_rides(
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_lat double precision,
  dropoff_lng double precision,
  radius_m integer DEFAULT 5000,
  from_time timestamp with time zone DEFAULT (now() - interval '2 hours'),
  to_time timestamp with time zone DEFAULT (now() + interval '30 days')
)
RETURNS TABLE(id uuid, driver_id uuid, origin_label text, destination_label text, depart_at timestamp with time zone, seats_left integer, status ride_status, price_per_seat numeric, pickup_distance_m double precision, dropoff_distance_m double precision, driver_name text, driver_photo text, driver_rating numeric)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
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
$function$;

REVOKE EXECUTE ON FUNCTION public.search_rides(double precision, double precision, double precision, double precision, integer, timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_rides(double precision, double precision, double precision, double precision, integer, timestamp with time zone, timestamp with time zone) TO authenticated;
