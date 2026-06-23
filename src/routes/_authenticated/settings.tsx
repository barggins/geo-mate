import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLocationSharing } from "@/components/PresenceTracker";
import { ensurePushPermissionAndRegister, isFcmConfigured } from "@/lib/fcm";
import { toast } from "sonner";
import { Bell, MapPin, MessageSquare, Phone, Smartphone, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type Prefs = {
  in_app_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  phone_e164: string | null;
  events_ride_request: boolean;
  events_request_decision: boolean;
  events_sos: boolean;
  events_chat: boolean;
  events_ride_status: boolean;
};

const DEFAULTS: Prefs = {
  in_app_enabled: true,
  push_enabled: true,
  sms_enabled: false,
  whatsapp_enabled: false,
  phone_e164: "",
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
  const [pushBusy, setPushBusy] = useState(false);

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
      .upsert({ user_id: user.id, ...merged, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
  };

  const enablePush = async () => {
    if (!user) return;
    setPushBusy(true);
    const res = await ensurePushPermissionAndRegister(user.id);
    setPushBusy(false);
    if (res.ok) {
      toast.success("Push notifications enabled on this device");
      save({ push_enabled: true });
    } else {
      toast.error(res.reason);
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Control how LiftClub reaches you and what you share.</p>

        {/* Location */}
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

        {/* Channels */}
        <Card className="mt-6 p-5">
          <h2 className="mb-4 font-semibold">Notification channels</h2>
          <div className="space-y-4">
            <Row
              icon={<Bell className="h-4 w-4" />}
              title="In-app notifications"
              hint="Bell icon updates instantly"
              checked={prefs.in_app_enabled}
              onChange={(v) => save({ in_app_enabled: v })}
            />
            <div className="flex items-center justify-between gap-4 border-t pt-4">
              <div className="flex items-start gap-3">
                <Smartphone className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">Browser push notifications</p>
                  <p className="text-xs text-muted-foreground">
                    {isFcmConfigured()
                      ? "Receive alerts even when the tab is closed."
                      : "Add Firebase credentials to enable web push."}
                  </p>
                </div>
              </div>
              {prefs.push_enabled ? (
                <Switch checked onCheckedChange={(v) => save({ push_enabled: v })} />
              ) : (
                <Button size="sm" disabled={pushBusy || !isFcmConfigured()} onClick={enablePush}>
                  {pushBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable"}
                </Button>
              )}
            </div>
            <Row
              icon={<MessageSquare className="h-4 w-4" />}
              title="SMS (Twilio)"
              hint="Coming soon — requires Twilio credentials"
              checked={prefs.sms_enabled}
              onChange={(v) => save({ sms_enabled: v })}
              badge="Soon"
            />
            <Row
              icon={<Phone className="h-4 w-4" />}
              title="WhatsApp (Twilio)"
              hint="Coming soon — requires Twilio WhatsApp sender"
              checked={prefs.whatsapp_enabled}
              onChange={(v) => save({ whatsapp_enabled: v })}
              badge="Soon"
            />
            {(prefs.sms_enabled || prefs.whatsapp_enabled) && (
              <div className="space-y-1.5 border-t pt-4">
                <Label htmlFor="phone">Phone number (E.164, e.g. +27821234567)</Label>
                <Input
                  id="phone"
                  value={prefs.phone_e164 ?? ""}
                  onChange={(e) => setPrefs((p) => ({ ...p, phone_e164: e.target.value }))}
                  onBlur={() => save({ phone_e164: prefs.phone_e164 })}
                  placeholder="+27821234567"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Events */}
        <Card className="mt-6 p-5">
          <h2 className="mb-4 font-semibold">Notify me about</h2>
          <div className="space-y-3">
            <Row title="New ride requests (as driver)" checked={prefs.events_ride_request} onChange={(v) => save({ events_ride_request: v })} />
            <Row title="Accept / reject decisions (as rider)" checked={prefs.events_request_decision} onChange={(v) => save({ events_request_decision: v })} />
            <Row title="SOS alerts (admins only)" checked={prefs.events_sos} onChange={(v) => save({ events_sos: v })} />
            <Row title="Chat messages" checked={prefs.events_chat} onChange={(v) => save({ events_chat: v })} />
            <Row title="Ride status updates" checked={prefs.events_ride_status} onChange={(v) => save({ events_ride_status: v })} />
          </div>
        </Card>

        {saving && <p className="mt-3 text-xs text-muted-foreground">Saving…</p>}
      </main>
    </div>
  );
}

function Row({
  icon, title, hint, checked, onChange, badge,
}: { icon?: React.ReactNode; title: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; badge?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && <span className="mt-0.5">{icon}</span>}
        <div>
          <p className="text-sm font-medium flex items-center gap-2">
            {title}
            {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
          </p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
