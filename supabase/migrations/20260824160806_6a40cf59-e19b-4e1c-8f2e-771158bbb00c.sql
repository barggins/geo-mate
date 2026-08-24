-- ============ driver payout details ============
CREATE TABLE IF NOT EXISTS public.driver_payment_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  bank_name text NOT NULL,
  account_holder text NOT NULL,
  account_number text NOT NULL,
  branch_code text,
  reference_hint text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_payment_details TO authenticated;
GRANT ALL ON public.driver_payment_details TO service_role;
ALTER TABLE public.driver_payment_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver manages own payout details" ON public.driver_payment_details
  FOR ALL TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "rider reads payout details via accepted booking" ON public.driver_payment_details
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ride_requests rr
      JOIN public.rides r ON r.id = rr.ride_id
      WHERE r.driver_id = driver_payment_details.driver_id
        AND rr.rider_id = auth.uid()
        AND rr.status = 'accepted'
    )
  );

CREATE POLICY "admins manage payout details" ON public.driver_payment_details
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_dpd_updated_at BEFORE UPDATE ON public.driver_payment_details
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ payment proofs ============
CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  amount_zar numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payment_proofs TO authenticated;
GRANT ALL ON public.payment_proofs TO service_role;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rider uploads own proof" ON public.payment_proofs
  FOR INSERT TO authenticated WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.ride_requests rr WHERE rr.id = request_id AND rr.rider_id = auth.uid())
  );

CREATE POLICY "booking parties read proof" ON public.payment_proofs
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.ride_requests rr JOIN public.rides r ON r.id = rr.ride_id
      WHERE rr.id = payment_proofs.request_id AND (rr.rider_id = auth.uid() OR r.driver_id = auth.uid())
    )
  );

CREATE POLICY "admins manage proofs" ON public.payment_proofs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ payment disputes ============
CREATE TABLE IF NOT EXISTS public.payment_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
  raised_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved_paid','resolved_unpaid')),
  admin_notes text,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_disputes TO authenticated;
GRANT ALL ON public.payment_disputes TO service_role;
ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking parties raise dispute" ON public.payment_disputes
  FOR INSERT TO authenticated WITH CHECK (
    raised_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.ride_requests rr JOIN public.rides r ON r.id = rr.ride_id
      WHERE rr.id = request_id AND (rr.rider_id = auth.uid() OR r.driver_id = auth.uid())
    )
  );

CREATE POLICY "booking parties read dispute" ON public.payment_disputes
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.ride_requests rr JOIN public.rides r ON r.id = rr.ride_id
      WHERE rr.id = payment_disputes.request_id AND (rr.rider_id = auth.uid() OR r.driver_id = auth.uid())
    )
  );

CREATE POLICY "admins resolve disputes" ON public.payment_disputes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete disputes" ON public.payment_disputes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ audit log (append-only) ============
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text, p_target_table text DEFAULT NULL, p_target_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.audit_log(actor_id, action, target_table, target_id, metadata)
  VALUES (auth.uid(), p_action, p_target_table, p_target_id, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) TO authenticated;

-- ============ booking payment columns ============
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz;

-- driver must have payout details before accepting; set 24h payment deadline
CREATE OR REPLACE FUNCTION public.enforce_payment_details_on_accept()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_driver uuid;
BEGIN
  IF NEW.status = 'accepted' AND COALESCE(OLD.status::text,'') <> 'accepted' THEN
    SELECT r.driver_id INTO v_driver FROM public.rides r WHERE r.id = NEW.ride_id;
    IF NOT EXISTS (SELECT 1 FROM public.driver_payment_details d WHERE d.driver_id = v_driver) THEN
      RAISE EXCEPTION 'Add your banking details before accepting bookings.';
    END IF;
    IF NEW.payment_expires_at IS NULL THEN
      NEW.payment_expires_at := now() + interval '24 hours';
    END IF;
    IF NEW.payment_status = 'unpaid' THEN
      NEW.payment_status := 'awaiting_payment';
    END IF;
  END IF;
  IF NEW.payment_status = 'paid' AND NEW.payment_confirmed_at IS NULL THEN
    NEW.payment_confirmed_at := now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_payment_details_on_accept ON public.ride_requests;
CREATE TRIGGER trg_payment_details_on_accept BEFORE UPDATE ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_details_on_accept();

-- expire stale unpaid bookings (callable by admins / service role)
CREATE OR REPLACE FUNCTION public.expire_unpaid_bookings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.ride_requests
     SET payment_status = 'expired'
   WHERE status = 'accepted'
     AND payment_status IN ('unpaid','awaiting_payment')
     AND payment_expires_at IS NOT NULL
     AND payment_expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.expire_unpaid_bookings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_unpaid_bookings() TO service_role;

-- ============ admin full control policies ============
CREATE POLICY "admins manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage rides" ON public.rides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage ride_requests" ON public.ride_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage groups" ON public.groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage group_stops" ON public.group_stops FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage group_members" ON public.group_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage driver_applications" ON public.driver_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage rider_verifications" ON public.rider_verifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage reviews" ON public.reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage messages" ON public.messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage sos_alerts" ON public.sos_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage profile_private" ON public.profile_private FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));