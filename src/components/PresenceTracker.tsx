import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const STORAGE_KEY = "liftclub.share_location";
const MIN_DISTANCE_M = 25;     // only upload when moved more than this
const MIN_INTERVAL_MS = 15_000; // ...or after this much time has passed

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Whether the current user is broadcasting their live location. */
export function useLocationSharing() {
  const { user } = useAuth();
  const [sharing, setSharing] = useState<boolean>(false);
  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number; t: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSharing(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!user) return;

    const stop = () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };

    if (!sharing) {
      stop();
      supabase
        .from("user_locations")
        .update({ sharing: false, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;

    const start = () => {
      if (watchRef.current != null) return;
      watchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          // Pause while tab is hidden to save battery
          if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

          const now = Date.now();
          const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const last = lastSentRef.current;
          if (last) {
            const moved = haversine(last, here);
            const elapsed = now - last.t;
            if (moved < MIN_DISTANCE_M && elapsed < MIN_INTERVAL_MS) return;
          }
          lastSentRef.current = { ...here, t: now };

          await supabase.from("user_locations").upsert(
            {
              user_id: user.id,
              lat: here.lat,
              lng: here.lng,
              heading: pos.coords.heading ?? null,
              speed_kmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
              sharing: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
      );
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVis);
    start();

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, [user, sharing]);

  const toggle = (next?: boolean) => {
    const v = next ?? !sharing;
    setSharing(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    }
  };

  return { sharing, toggle };
}

export function PresenceTracker() {
  useLocationSharing();
  return null;
}
