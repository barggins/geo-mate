
-- Avatars bucket: users manage files under <uid>/...; signed URLs used for read
CREATE POLICY "avatars_owner_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_authed_read_all" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Rating aggregation trigger
CREATE OR REPLACE FUNCTION public.recompute_user_rating(_uid uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles p
  SET rating = COALESCE(s.avg, 0),
      rating_count = COALESCE(s.cnt, 0)
  FROM (
    SELECT AVG(rating)::numeric(3,2) AS avg, COUNT(*) AS cnt
    FROM public.reviews WHERE to_user = _uid
  ) s
  WHERE p.id = _uid;
$$;
REVOKE EXECUTE ON FUNCTION public.recompute_user_rating(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_reviews_update_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_user_rating(OLD.to_user);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_user_rating(NEW.to_user);
    IF TG_OP = 'UPDATE' AND OLD.to_user <> NEW.to_user THEN
      PERFORM public.recompute_user_rating(OLD.to_user);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trg_reviews_update_rating() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reviews_rating_sync ON public.reviews;
CREATE TRIGGER reviews_rating_sync
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.trg_reviews_update_rating();

-- Backfill
UPDATE public.profiles p SET
  rating = COALESCE(s.avg, 0),
  rating_count = COALESCE(s.cnt, 0)
FROM (
  SELECT to_user, AVG(rating)::numeric(3,2) AS avg, COUNT(*) AS cnt
  FROM public.reviews GROUP BY to_user
) s
WHERE p.id = s.to_user;
