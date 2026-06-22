import { useState } from "react";
import { AlertTriangle, Phone, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

/**
 * Floating SOS button.
 * - Logs an sos_alert row (with last-known GPS if available)
 * - Triggers a tel: call to the South African Police (10111)
 */
export function EmergencyButton({ rideId }: { rideId?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const trigger = async () => {
    setBusy(true);
    let coords: { lat: number; lng: number } | null = null;
    try {
      coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 30_000 },
        );
      });
    } catch {
      coords = null;
    }

    const { error } = await supabase.from("sos_alerts").insert({
      user_id: user.id,
      ride_id: rideId ?? null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    });
    setBusy(false);
    setOpen(false);

    if (error) {
      toast.error("Could not log alert: " + error.message);
    } else {
      toast.success("SOS sent — connecting you to SAPS (10111)…");
    }
    // Trigger phone dialer
    window.location.href = "tel:10111";
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-red-600 p-0 text-white shadow-2xl ring-4 ring-red-600/30 hover:bg-red-700 animate-pulse"
        aria-label="Emergency — call SAPS"
        title="Emergency — call 10111"
      >
        <AlertTriangle className="h-6 w-6" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Call South African Police (10111)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will log an emergency alert with your current location and dial{" "}
              <span className="font-semibold">10111</span> (SAPS Flying Squad). Use only in a
              real emergency.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                trigger();
              }}
              disabled={busy}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Phone className="mr-2 h-4 w-4" />
              )}
              Call SAPS now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
