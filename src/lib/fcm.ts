// Firebase Cloud Messaging registration. Gracefully no-ops if env vars are
// missing so the rest of the app keeps working until secrets are provided.
import { supabase } from "@/integrations/supabase/client";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined,
};

export const isFcmConfigured = () =>
  Boolean(cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId && cfg.vapidKey);

export async function ensurePushPermissionAndRegister(userId: string): Promise<
  { ok: true; token: string } | { ok: false; reason: string }
> {
  if (typeof window === "undefined") return { ok: false, reason: "ssr" };
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    return { ok: false, reason: "Browser does not support push notifications" };
  }
  if (!isFcmConfigured()) {
    return { ok: false, reason: "Push not configured yet — add Firebase credentials." };
  }

  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Notifications denied" };

  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getMessaging, getToken } = await import("firebase/messaging");
    const app = getApps()[0] ?? initializeApp(cfg as any);
    const messaging = getMessaging(app);

    const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(messaging, {
      vapidKey: cfg.vapidKey!,
      serviceWorkerRegistration: swReg,
    });
    if (!token) return { ok: false, reason: "Could not retrieve push token" };

    await supabase.from("device_tokens").upsert(
      {
        user_id: userId,
        token,
        platform: "web",
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    return { ok: true, token };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "Failed to register push" };
  }
}
