
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_ride_request(UUID) FROM PUBLIC, anon;
