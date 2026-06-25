import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLocationSharing } from "@/components/PresenceTracker";
import {
  isBrowserNotifySupported,
  browserNotifyPermission,
  requestBrowserNotifyPermission,
  showBrowserNotification,
} from "@/lib/browser-notify";
import { toast } from "sonner";
import { Bell, MapPin, Smartphone, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type Prefs = {
  in_app_enabled: boolean;
  browser_enabled: boolean;
  events_ride_request: boolean;
  events_request_decision: boolean;
  events_sos: boolean;
  events_chat: boolean;
  events_ride_status: boolean;
};

const DEFAULTS: Prefs = {
  in_app_enabled: true,
  browser_enabled: true,
  events_ride_request: true,
  events_request_decision: true,
  events_sos: true,
  events_chat: true,
  events_ride_status: true,
};

function SettingsPage() {
  const { user } = useAuth();
  const { sharing, toggle: toggleLocation } = useLocationSharing();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPermission(browserNotifyPermission());
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notification_prefs")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPrefs({ ...DEFAULTS, ...(data as any) });
        setLoading(false);
      });
  }, [user]);

  const save = async (next: Partial<Prefs>) => {
    if (!user) return;
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    setSaving(true);
    const { error } = await supabase
      .from("notification_prefs")
      .upsert(
        { user_id: user.id, ...merged, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) toast.error(error.message);
  };

  const enableBrowser = async () => {
    setBusy(true);
    const result = await requestBrowserNotifyPermission();
    setPermission(result);
    setBusy(false);
    if (result === "granted") {
      showBrowserNotification("LiftClub notifications on", {
        body: "You'll get an alert here when something needs you.",
      });
      await save({ browser_enabled: true });
      toast.success("Browser notifications enabled");
    } else if (result === "denied") {
      toast.error("Browser blocked notifications. Enable them in site settings.");
    } else if (result === "unsupported") {
      toast.error("This browser doesn't support notifications.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const canShowBrowser = isBrowserNotifySupported() && permission === "granted";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Control how LiftClub reaches you and what you share.
        </p>

        <Card className="mt-6 p-5">
          <div className="flex items-start gap-3">
            <MapPin className="mt-1 h-5 w-5 text-[color:var(--brand-blue)]" />
            <div className="flex-1">
              <p className="font-semibold">Live location sharing</p>
              <p className="text-sm text-muted-foreground">
                Used to match nearby rides, show your pin on the live map for ride partners, and
                pinpoint you in an emergency. Updates are throttled to save battery.
              </p>
            </div>
            <Switch checked={sharing} onCheckedChange={(v) => toggleLocation(v)} />
          </div>
        </Card>

        <Card className="mt-6 p-5">
          <h2 className="mb-4 font-semibold">Notification channels</h2>
          <div className="space-y-4">
            <Row
              icon={<Bell className="h-4 w-4" />}
              title="In-app notifications"
              hint="Bell icon updates instantly while you're using LiftClub."
              checked={prefs.in_app_enabled}
              onChange={(v) => save({ in_app_enabled: v })}
            />
            <div className="flex items-center justify-between gap-4 border-t pt-4">
              <div className="flex items-start gap-3">
                <Smartphone className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    Browser notifications
                    {permission === "granted" && (
                      <Badge variant="secondary" className="text-[10px]">Enabled</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    OS-level alerts while LiftClub is open in any tab. Free, no setup.
                  </p>
                </div>
              </div>
              {canShowBrowser ? (
                <Switch
                  checked={prefs.browser_enabled}
                  onCheckedChange={(v) => save({ browser_enabled: v })}
                />
              ) : (
                <Button size="sm" disabled={busy || permission === "denied"} onClick={enableBrowser}>
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : permission === "denied" ? (
                    "Blocked"
                  ) : (
                    "Enable"
                  )}
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="mt-6 p-5">
          <h2 className="mb-4 font-semibold">Notify me about</h2>
          <div className="space-y-3">
            <Row
              title="New ride requests (as driver)"
              checked={prefs.events_ride_request}
              onChange={(v) => save({ events_ride_request: v })}
            />
            <Row
              title="Accept / reject decisions (as rider)"
              checked={prefs.events_request_decision}
              onChange={(v) => save({ events_request_decision: v })}
            />
            <Row
              title="SOS alerts (admins only)"
              checked={prefs.events_sos}
              onChange={(v) => save({ events_sos: v })}
            />
            <Row
              title="Chat messages"
              checked={prefs.events_chat}
              onChange={(v) => save({ events_chat: v })}
            />
            <Row
              title="Ride status updates"
              checked={prefs.events_ride_status}
              onChange={(v) => save({ events_ride_status: v })}
            />
          </div>
        </Card>

        {saving && <p className="mt-3 text-xs text-muted-foreground">Saving…</p>}
      </main>
    </div>
  );
}

function Row({
  icon,
  title,
  hint,
  checked,
  onChange,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && <span className="mt-0.5">{icon}</span>}
        <div>
          <p className="text-sm font-medium">{title}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
