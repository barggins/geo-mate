import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { AlertTriangle, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sos")({
  component: SosPage,
});

function SosPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("sos_alerts")
      .select("*, profiles!sos_alerts_user_id_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((r: any) => r.user_id)));
    if (ids.length) {
      const { data: priv } = await supabase.from("profile_private").select("user_id, phone").in("user_id", ids);
      const map = new Map((priv ?? []).map((p: any) => [p.user_id, p.phone]));
      rows.forEach((r: any) => { r.phone = map.get(r.user_id) ?? null; });
    }
    setAlerts(rows);
  };



  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("sos-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_alerts" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <AlertTriangle className="h-7 w-7 text-red-600" /> Emergency alerts
        </h1>
        <p className="text-muted-foreground">
          Your SOS history. Admins can also see and resolve alerts from other members.
        </p>

        <div className="mt-6 space-y-3">
          {alerts.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No emergency alerts. Stay safe out there. 💙
            </Card>
          )}
          {alerts.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {a.profiles?.name ?? "Member"}
                    {a.phone && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · {a.phone}
                      </span>
                    )}


                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(a.created_at), "EEE d MMM, HH:mm:ss")}
                  </p>
                  {a.lat != null && a.lng != null && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=17/${a.lat}/${a.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-[color:var(--brand-blue)] hover:underline"
                    >
                      <MapPin className="h-3 w-3" />
                      {a.lat.toFixed(5)}, {a.lng.toFixed(5)}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={a.status === "active" ? "destructive" : "secondary"}
                    className="uppercase"
                  >
                    {a.status}
                  </Badge>
                  {a.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const { error } = await supabase
                          .from("sos_alerts")
                          .update({
                            status: "resolved",
                            resolved_at: new Date().toISOString(),
                            resolved_by: user!.id,
                          })
                          .eq("id", a.id);
                        if (error) toast.error(error.message);
                        else toast.success("Marked resolved");
                      }}
                    >
                      Mark resolved
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
