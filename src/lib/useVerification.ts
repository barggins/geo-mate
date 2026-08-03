import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type KycState = "loading" | "none" | "pending" | "approved" | "rejected";

export type VerificationInfo = {
  loading: boolean;
  role: "rider" | "driver";
  profile: any | null;
  /** Admin-confirmed identity badge on the profile. */
  verified: boolean;
  /** Driver KYC application state (drivers only). */
  driverStatus: KycState;
  /** Rider identity verification state (riders only). */
  riderStatus: KycState;
  /** Number of bookings that are pending or accepted right now. */
  activeBookings: number;
  /** Unverified riders are capped; verified riders are not. */
  bookingLimit: number | null;
  reload: () => void;
};

export const UNVERIFIED_RIDER_BOOKING_LIMIT = 1;

/**
 * Single source of truth for "what is this user allowed to do next".
 * Mirrors the database rules (RLS + triggers) so the UI can explain them
 * before the user hits a server-side block.
 */
export function useVerification(userId: string | undefined): VerificationInfo {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);
  const [driverStatus, setDriverStatus] = useState<KycState>("loading");
  const [riderStatus, setRiderStatus] = useState<KycState>("loading");
  const [activeBookings, setActiveBookings] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [{ data: prof }, { data: driverApp }, { data: riderVer }, { count }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("driver_applications").select("status").eq("user_id", userId).maybeSingle(),
        supabase.from("rider_verifications").select("status").eq("user_id", userId).maybeSingle(),
        supabase
          .from("ride_requests")
          .select("id", { count: "exact", head: true })
          .eq("rider_id", userId)
          .in("status", ["pending", "accepted"]),
      ]);
      if (cancelled) return;
      setProfile(prof ?? null);
      setDriverStatus((driverApp?.status as KycState) ?? "none");
      setRiderStatus((riderVer?.status as KycState) ?? "none");
      setActiveBookings(count ?? 0);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, tick]);

  const role: "rider" | "driver" = profile?.role ?? "rider";
  const verified = !!profile?.verified;

  return {
    loading,
    role,
    profile,
    verified,
    driverStatus,
    riderStatus,
    activeBookings,
    bookingLimit: verified ? null : UNVERIFIED_RIDER_BOOKING_LIMIT,
    reload: () => setTick((t) => t + 1),
  };
}

/** Can this user post a ride? */
export function canPostRide(v: VerificationInfo) {
  if (v.role !== "driver") return { allowed: false, reason: "Only driver accounts can post rides. Switch your role in your profile." };
  if (v.driverStatus === "approved") return { allowed: true as const, reason: "" };
  if (v.driverStatus === "pending") return { allowed: false, reason: "Your driver application is under review. You can post rides once an admin approves it." };
  if (v.driverStatus === "rejected") return { allowed: false, reason: "Your driver application was rejected. Update your documents and resubmit." };
  return { allowed: false, reason: "Upload your licence, vehicle papers and banking details to start posting rides." };
}

/** Can this user request another seat? */
export function canRequestSeat(v: VerificationInfo) {
  if (v.bookingLimit !== null && v.activeBookings >= v.bookingLimit) {
    return {
      allowed: false,
      reason: `Unverified riders can hold ${v.bookingLimit} active booking at a time. Verify your identity to book more rides.`,
    };
  }
  return { allowed: true as const, reason: "" };
}
