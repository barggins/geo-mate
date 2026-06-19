import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { Loader2, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rides-log")({
  component: RidesLog,
});

function RidesLog() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("ride_log")
        .select("*, rides(origin_label, destination_label, depart_at)")
        .order("created_at", { ascending: false })
        .limit(200);
      setEvents(data ?? []);
    };
    load();
    const channel = supabase
      .channel(`ride-log-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ride_log" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg brand-gradient text-white"><History className="h-5 w-5" /></div>
          <div>
            <h1 className="text-3xl font-bold">Ride log</h1>
            <p className="text-muted-foreground">A live audit trail of every ride you're part of.</p>
          </div>
        </div>
        {events === null ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : events.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No ride activity yet.</Card>
        ) : (
          <Card className="divide-y">
            {events.map((e) => (
              <Link key={e.id} to="/ride/$id" params={{ id: e.ride_id }} className="block p-4 transition-colors hover:bg-accent/30">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.rides?.origin_label} → {e.rides?.destination_label}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(e.created_at), "EEE d MMM, HH:mm:ss")}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{String(e.event).replaceAll("_", " ")}</Badge>
                </div>
              </Link>
            ))}
          </Card>
        )}
      </main>
    </div>
  );
}
