
## Goal

Remove every Firebase dependency and replace push notifications with a fully free, zero-third-party stack: Supabase Realtime (already in use) for delivery + the browser's native Notification API for OS-level toasts when the tab is open or recently backgrounded. No service worker push, no FCM, no VAPID, no Twilio.

## What gets removed

**Files deleted**
- `src/lib/fcm.ts`
- `public/firebase-messaging-sw.js`

**Files edited to remove Firebase imports/usage**
- `src/routes/_authenticated/route.tsx` — remove any FCM init call
- `src/routes/_authenticated/settings.tsx` — remove "Enable Push" Firebase button, keep in-app + browser-notification toggles
- `src/components/NotificationBell.tsx` — keep as-is (already realtime; no Firebase)
- `src/lib/notifications.ts` — drop any FCM token registration; keep `notifications` table helpers

**Package removals (`bun remove`)**
- `firebase`
- any `@firebase/*` transitive direct deps if present

**DB schema cleanup (migration)**
- Drop `public.device_tokens` table (Firebase-only)
- Drop SMS/WhatsApp columns on `notification_prefs` (we're in-app + browser only)
- Keep `notifications`, `notification_prefs (in_app, browser)`, all enqueue triggers — they're channel-agnostic

## What replaces Firebase

**1. In-app realtime (already working)**
`NotificationBell` subscribes to `postgres_changes` on `public.notifications` filtered by `user_id`. New rows pop instantly with unread badge.

**2. Native browser notifications (new, ~40 lines)**
New file `src/lib/browser-notify.ts`:
- `requestNotificationPermission()` — wraps `Notification.requestPermission()`
- `showBrowserNotification(title, body, url?)` — fires `new Notification(...)` when permission granted, click focuses tab + routes
- Respects user's `notification_prefs.browser` toggle

Wired into `NotificationBell`'s realtime handler: every new row → in-app toast + (if enabled & permitted) OS notification. Works on desktop Chrome/Edge/Firefox/Safari while the site is open in any tab.

**3. Settings page**
`/settings` keeps two toggles:
- In-app notifications (always on, info-only)
- Browser notifications (requests permission on enable)

SMS/WhatsApp/Push rows removed.

## What stays untouched

- All ride / chat / SOS / request triggers that insert into `notifications`
- Realtime subscriptions
- `FirstLoginLocationPrompt`, `PresenceTracker` smart-throttle, geotracking work
- Everything else in the app

## Trade-offs (so you're not surprised)

- No notifications when the tab is fully closed. That's the cost of "100% free, zero third party". To add background push later, the cheapest path is native Web Push + VAPID via the `web-push` library in a server fn — no Firebase needed. I'll note this in the settings page as "coming soon" only if you want.

## Technical details

- Migration drops `device_tokens` + `sms`, `whatsapp`, `push` columns on `notification_prefs`; adds `browser boolean default true`.
- `bun remove firebase` then verify `package.json` and `bun.lock` are clean.
- `src/lib/browser-notify.ts` is browser-only — imported inside `useEffect` or event handlers, never at module scope of a server-touching file.
- `NotificationBell` handler: on new row, call `toast(...)` AND `showBrowserNotification(...)` guarded by `prefs.browser && Notification.permission === 'granted' && document.visibilityState !== 'visible'` (don't double-notify a focused user).

## Files changed summary

Deleted: `src/lib/fcm.ts`, `public/firebase-messaging-sw.js`
Created: `src/lib/browser-notify.ts`, one Supabase migration
Edited: `src/lib/notifications.ts`, `src/components/NotificationBell.tsx`, `src/routes/_authenticated/settings.tsx`, `src/routes/_authenticated/route.tsx`, `package.json`, `bun.lock`

That's the full scope. Approve and I'll execute in one pass.
