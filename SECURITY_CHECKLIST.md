# LiftClub — Post-Deploy Security Verification Checklist

Run these end-to-end against the **published** site (not just preview) with two
real accounts: `driverA@test` and `riderB@test`. A third `attacker@test`
account is used for negative tests. None of them are admins.

---

## 1. Fake reviews cannot be posted

**Goal:** Only the driver and accepted riders of a **completed** ride can
review each other.

- [ ] Sign in as `attacker@test`. Open the browser console and try:
  ```js
  const { supabase } = await import('/src/integrations/supabase/client.ts');
  await supabase.from('reviews').insert({
    ride_id: '<any real ride id>',
    from_user: (await supabase.auth.getUser()).data.user.id,
    to_user: '<driverA user id>',
    rating: 1, comment: 'fake'
  });
  ```
  ✅ Expected: `new row violates row-level security policy`.

- [ ] Repeat as `riderB` on a ride that is **not yet completed**
  (`status != 'completed'`). ✅ Expected: RLS rejection.

- [ ] Repeat as `riderB` on a ride they were **not** an accepted passenger of.
  ✅ Expected: RLS rejection.

- [ ] Happy path: complete a ride where `riderB` was accepted, then submit a
  review from `riderB` → `driverA`. ✅ Expected: success, row appears in
  `reviews` and on the driver's profile.

- [ ] Unauthenticated: sign out, try to `SELECT * FROM reviews` via the anon
  key. ✅ Expected: empty / permission error (reviews require auth).

---

## 2. Verified badge cannot be self-granted

**Goal:** The `profiles.verified` flag is admin-only.

- [ ] Sign in as `riderB`. In the console:
  ```js
  const { supabase } = await import('/src/integrations/supabase/client.ts');
  const uid = (await supabase.auth.getUser()).data.user.id;
  const { data, error } = await supabase
    .from('profiles').update({ verified: true }).eq('id', uid).select();
  console.log({ data, error });
  ```
  ✅ Expected: either an RLS/column error, OR the update runs but `verified`
  stays `false` (blocked column). Confirm in DB with
  `SELECT verified FROM profiles WHERE id = '<riderB id>'` → still `false`.

- [ ] Confirm normal fields still update (name, bio, photo_url) from the
  Profile page UI.

- [ ] Sign in as an admin (a user with `admin` in `user_roles`) and toggle
  `verified` on `riderB` from `/admin`. ✅ Expected: succeeds, badge appears
  on `riderB`'s public profile.

- [ ] Sign in as `riderB` again and try to flip `verified` back to `false`
  themselves. ✅ Expected: blocked (admin-only).

---

## 3. Location sharing is scoped to trip participants

**Goal:** GPS in `user_locations` is visible only to (a) the owner and
(b) users sharing an **active or accepted** ride with them.

- [ ] `driverA` posts a ride, toggles "Share my location" on `/live-map`.
  Verify a row appears in `user_locations` with `sharing = true`.

- [ ] `riderB` (no ride relation to `driverA` yet) opens the console:
  ```js
  const { supabase } = await import('/src/integrations/supabase/client.ts');
  const { data, error } = await supabase
    .from('user_locations').select('*').eq('user_id', '<driverA id>');
  console.log({ data, error });
  ```
  ✅ Expected: `data` is `[]` (RLS filters the row out).

- [ ] `riderB` requests `driverA`'s ride, `driverA` accepts. Repeat the query.
  ✅ Expected: the row is now visible.

- [ ] After the ride is marked `completed` or the request is `cancelled`,
  repeat the query. ✅ Expected: `[]` again.

- [ ] `attacker@test` (never a participant) runs the same query at every
  stage. ✅ Expected: always `[]`.

- [ ] `driverA` toggles sharing **off**. Verify `sharing = false` in the row
  and that `/live-map` no longer plots them for anyone (including
  participants — sharing off means off).

- [ ] Owner sanity check: `driverA` can always `SELECT` their own row
  regardless of sharing state.

---

## 4. Regression smoke test

- [ ] Sign-up requires email confirmation (no auto-login).
- [ ] Search for rides "near me" returns results within the chosen radius.
- [ ] SOS button logs an `sos_alerts` row and triggers the 10111 call.
- [ ] Chat messages between ride participants send + receive in realtime.
- [ ] `/admin` is 403 / redirect for non-admin users.

---

## 5. Automated re-scan

- [ ] In Lovable, open the Security panel and run **Run scan** again.
  ✅ Expected: `profile_self_verify`, `reviews_no_participation`, and the
  `user_locations` participant policy show as **Fixed** with no new
  error-level findings.
