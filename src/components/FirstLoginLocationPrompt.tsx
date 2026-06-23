import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLocationSharing } from "./PresenceTracker";

const KEY = "liftclub.location_prompt_seen";

export function FirstLoginLocationPrompt() {
  const { user } = useAuth();
  const { toggle } = useLocationSharing();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    if (window.localStorage.getItem(KEY)) return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [user]);

  const close = (enabled: boolean) => {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, "1");
    setOpen(false);
    if (enabled) toggle(true);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full brand-gradient text-white">
            <MapPin className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Share your location?</DialogTitle>
          <DialogDescription className="text-center">
            We use your live location to match you with nearby rides, show you on the live map for
            ride partners, and send help quickly if you trigger an SOS. You can change this anytime
            in Settings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full brand-gradient text-white" onClick={() => close(true)}>
            Enable location sharing
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => close(false)}>
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
