-- allow payment-workflow functions to bypass the payment guard
CREATE OR REPLACE FUNCTION public.guard_payment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role'
     OR auth.uid() IS NULL
     OR current_setting('liftclub.payment_service', true) = 'on' THEN
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
END; $$;
REVOKE ALL ON FUNCTION public.guard_payment_status() FROM PUBLIC, anon, authenticated;

-- rider submits proof of an EFT
CREATE OR REPLACE FUNCTION public.submit_payment_proof(
  p_request_id uuid, p_file_url text, p_amount numeric DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ride_requests rr
    WHERE rr.id = p_request_id AND rr.rider_id = auth.uid() AND rr.status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Only the rider on an accepted booking can submit proof of payment.';
  END IF;

  INSERT INTO public.payment_proofs(request_id, uploaded_by, file_url, amount_zar, note)
  VALUES (p_request_id, auth.uid(), p_file_url, p_amount, p_note)
  RETURNING id INTO v_id;

  PERFORM set_config('liftclub.payment_service', 'on', true);
  UPDATE public.ride_requests
     SET payment_status = 'proof_uploaded'
   WHERE id = p_request_id AND payment_status IN ('unpaid','awaiting_payment','expired','disputed');
  PERFORM set_config('liftclub.payment_service', 'off', true);
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.submit_payment_proof(uuid, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(uuid, text, numeric, text) TO authenticated;

-- driver confirms the money arrived
CREATE OR REPLACE FUNCTION public.confirm_payment_received(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ride_requests rr JOIN public.rides r ON r.id = rr.ride_id
    WHERE rr.id = p_request_id AND r.driver_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the driver of this ride can confirm payment.';
  END IF;
  PERFORM set_config('liftclub.payment_service', 'on', true);
  UPDATE public.ride_requests
     SET payment_status = 'paid', paid_at = now(), payment_confirmed_at = now()
   WHERE id = p_request_id;
  PERFORM set_config('liftclub.payment_service', 'off', true);
END; $$;
REVOKE ALL ON FUNCTION public.confirm_payment_received(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment_received(uuid) TO authenticated;

-- either party raises a payment dispute
CREATE OR REPLACE FUNCTION public.raise_payment_dispute(p_request_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ride_requests rr JOIN public.rides r ON r.id = rr.ride_id
    WHERE rr.id = p_request_id AND (rr.rider_id = auth.uid() OR r.driver_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Only the rider or driver on this booking can raise a dispute.';
  END IF;
  IF coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required.';
  END IF;

  INSERT INTO public.payment_disputes(request_id, raised_by, reason)
  VALUES (p_request_id, auth.uid(), left(p_reason, 1000))
  RETURNING id INTO v_id;

  PERFORM set_config('liftclub.payment_service', 'on', true);
  UPDATE public.ride_requests SET payment_status = 'disputed' WHERE id = p_request_id;
  PERFORM set_config('liftclub.payment_service', 'off', true);
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.raise_payment_dispute(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raise_payment_dispute(uuid, text) TO authenticated;

-- admin resolves a dispute
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(p_dispute_id uuid, p_outcome text, p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_request uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only.';
  END IF;
  IF p_outcome NOT IN ('resolved_paid','resolved_unpaid') THEN
    RAISE EXCEPTION 'Invalid outcome.';
  END IF;

  UPDATE public.payment_disputes
     SET status = p_outcome, admin_notes = p_notes, resolved_by = auth.uid(), resolved_at = now()
   WHERE id = p_dispute_id
  RETURNING request_id INTO v_request;

  IF v_request IS NULL THEN RAISE EXCEPTION 'Dispute not found.'; END IF;

  PERFORM set_config('liftclub.payment_service', 'on', true);
  UPDATE public.ride_requests
     SET payment_status = CASE WHEN p_outcome = 'resolved_paid' THEN 'paid'::payment_status ELSE 'unpaid'::payment_status END,
         paid_at = CASE WHEN p_outcome = 'resolved_paid' THEN now() ELSE NULL END,
         payment_confirmed_at = CASE WHEN p_outcome = 'resolved_paid' THEN now() ELSE NULL END
   WHERE id = v_request;
  PERFORM set_config('liftclub.payment_service', 'off', true);

  INSERT INTO public.audit_log(actor_id, action, target_table, target_id, metadata)
  VALUES (auth.uid(), 'resolve_payment_dispute', 'payment_disputes', p_dispute_id,
          jsonb_build_object('outcome', p_outcome, 'notes', p_notes, 'request_id', v_request));
END; $$;
REVOKE ALL ON FUNCTION public.admin_resolve_dispute(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid, text, text) TO authenticated;