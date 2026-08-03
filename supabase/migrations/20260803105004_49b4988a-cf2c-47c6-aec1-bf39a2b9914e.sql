-- Ride edits must also come from an approved driver
DROP POLICY IF EXISTS rides_update_driver ON public.rides;
CREATE POLICY rides_update_driver ON public.rides
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = driver_id
    AND EXISTS (
      SELECT 1 FROM public.driver_applications da
      WHERE da.user_id = auth.uid() AND da.status = 'approved'
    )
  )
  WITH CHECK (
    auth.uid() = driver_id
    AND EXISTS (
      SELECT 1 FROM public.driver_applications da
      WHERE da.user_id = auth.uid() AND da.status = 'approved'
    )
  );

-- Live location visible only to counterparties on a still-active ride
DROP POLICY IF EXISTS user_locations_select_ride_participants ON public.user_locations;
CREATE POLICY user_locations_select_ride_participants ON public.user_locations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      sharing = true
      AND EXISTS (
        SELECT 1
        FROM public.rides r
        JOIN public.ride_requests rr ON rr.ride_id = r.id
        WHERE rr.status = 'accepted'
          AND r.status IN ('scheduled', 'in_progress')
          AND (
            (r.driver_id = user_locations.user_id AND rr.rider_id = auth.uid())
            OR (rr.rider_id = user_locations.user_id AND r.driver_id = auth.uid())
          )
      )
    )
  );