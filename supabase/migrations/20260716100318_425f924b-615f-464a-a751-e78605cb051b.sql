
DROP POLICY IF EXISTS rides_insert_driver ON public.rides;
CREATE POLICY rides_insert_driver ON public.rides
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = driver_id
    AND EXISTS (
      SELECT 1 FROM public.driver_applications da
      WHERE da.user_id = auth.uid() AND da.status = 'approved'
    )
  );
