-- lock down internal-only functions
REVOKE ALL ON FUNCTION public.enforce_payment_details_on_accept() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_unpaid_bookings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_payment_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_rider_verif_on_decision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) TO authenticated;

-- payment proof storage policies
DROP POLICY IF EXISTS "rider uploads own payment proof" ON storage.objects;
CREATE POLICY "rider uploads own payment proof" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "payment proof readable by parties" ON storage.objects;
CREATE POLICY "payment proof readable by parties" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.payment_proofs pp
        JOIN public.ride_requests rr ON rr.id = pp.request_id
        JOIN public.rides r ON r.id = rr.ride_id
        WHERE pp.file_url = storage.objects.name AND r.driver_id = auth.uid()
      )
    )
  );