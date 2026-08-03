-- ============ 1. Booking-scoped chat ============
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.ride_requests(id) ON DELETE CASCADE;

-- Backfill: attach each message to the sender's booking on that ride where unambiguous
UPDATE public.messages m
SET request_id = rr.id
FROM public.ride_requests rr
WHERE m.request_id IS NULL
  AND rr.ride_id = m.ride_id
  AND rr.status = 'accepted'
  AND (
    rr.rider_id = m.sender_id
    OR (SELECT r.driver_id FROM public.rides r WHERE r.id = m.ride_id) = m.sender_id
  );

CREATE INDEX IF NOT EXISTS messages_request_id_created_at_idx
  ON public.messages (request_id, created_at);

-- Helper: is the current user a participant in this booking thread?
CREATE OR REPLACE FUNCTION public.can_access_booking_thread(_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ride_requests rr
    JOIN public.rides r ON r.id = rr.ride_id
    WHERE rr.id = _request_id
      AND rr.status = 'accepted'
      AND (rr.rider_id = auth.uid() OR r.driver_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin');
$$;

REVOKE ALL ON FUNCTION public.can_access_booking_thread(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_booking_thread(uuid) TO authenticated;

DROP POLICY IF EXISTS messages_select_participants ON public.messages;
CREATE POLICY messages_select_participants ON public.messages
  FOR SELECT TO authenticated
  USING (
    request_id IS NOT NULL
    AND public.can_access_booking_thread(request_id)
  );

DROP POLICY IF EXISTS messages_insert_participants ON public.messages;
CREATE POLICY messages_insert_participants ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND request_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.ride_requests rr
      JOIN public.rides r ON r.id = rr.ride_id
      WHERE rr.id = messages.request_id
        AND rr.ride_id = messages.ride_id
        AND rr.status = 'accepted'
        AND (rr.rider_id = auth.uid() OR r.driver_id = auth.uid())
    )
  );

-- ============ 2. Payment state on bookings ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM ('unpaid', 'awaiting_payment', 'paid', 'failed', 'refunded');
  END IF;
END $$;

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS amount_zar numeric(10,2),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ride_requests_payment_reference_key
  ON public.ride_requests (payment_reference) WHERE payment_reference IS NOT NULL;

-- Only the server (service role) may mark a booking paid/refunded.
CREATE OR REPLACE FUNCTION public.guard_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role'
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     AND NEW.payment_status IN ('paid', 'refunded') THEN
    RAISE EXCEPTION 'Payment status can only be confirmed by the payment verification service';
  END IF;

  IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
    RAISE EXCEPTION 'paid_at is set by the payment verification service';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_payment_status ON public.ride_requests;
CREATE TRIGGER trg_guard_payment_status
  BEFORE UPDATE ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_payment_status();

-- ============ 3. Realtime ============
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ride_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_requests;
  END IF;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.ride_requests REPLICA IDENTITY FULL;