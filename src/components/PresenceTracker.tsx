import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const STORAGE_KEY = "liftclub.share_location";

/** Returns whether the current user is broadcasting their live location. */
export function useLocationSharing() {
  const { user } = useAuth();
  const [sharing, setSharing] = useState<boolean>(false);
  const watchRef = useRef<number | null>(null);

  // Load preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSharing(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // Drive geolocation watch
  useEffect(() => {
    if (!user) return;
    if (!sharing) {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      // mark as not sharing in DB
      supabase
        .from("user_locations")
        .update({ sharing: false, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      return;
    }
    if (!("geolocation" in navigator)) return;

    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        await supabase.from("user_locations").upsert(
          {
            user_id: user.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading ?? null,
            speed_kmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
            sharing: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
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

/** Mount-only invisible component to keep the watch alive across pages. */
export function PresenceTracker() {
  useLocationSharing();
  return null;
}
