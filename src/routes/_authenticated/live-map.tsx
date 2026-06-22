import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ClientOnly } from "@/components/ClientOnly";
import LeafletMap, { carIcon } from "@/components/LeafletMap";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLocationSharing } from "@/components/PresenceTracker";
import { formatDistanceToNow } from "date-fns";
import { Radio, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/live-map")({
  component: LiveMapPage,
});

type TrackedUser = {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
  sharing: boolean;
  name?: string | null;
  photo_url?: string | null;
};

function LiveMapPage() {
  const { user } = useAuth();
  const { sharing, toggle } = useLocationSharing();
  const [people, setPeople] = useState<TrackedUser[]>([]);

  const load = async () => {
    // Last 30 minutes of activity
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: locs } = await supabase
      .from("user_locations")
      .select("*")
      .eq("sharing", true)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false });
    const ids = (locs ?? []).map((l) => l.user_id);
    let profiles: any[] = [];
    if (ids.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, photo_url")
        .in("id", ids);
      profiles = data ?? [];
    }
    const merged: TrackedUser[] = (locs ?? []).map((l: any) => {
      const p = profiles.find((x) => x.id === l.user_id);
      return { ...l, name: p?.name, photo_url: p?.photo_url };
    });
    setPeople(merged);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("user-locations-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_locations" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const markers = people.map((p) => ({
    position: [p.lat, p.lng] as [number, number],
    icon: carIcon,
  }));

  const center: [number, number] = people[0]
    ? [people[0].lat, people[0].lng]
    : [-29.8587, 31.0218]; // Durban as a SA-friendly default

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Live map</h1>
            <p className="text-muted-foreground">
              See every LiftClub member currently sharing their location.
            </p>
          </div>
          <Card className="flex items-center gap-3 px-4 py-3">
            <Radio
              className={`h-4 w-4 ${sharing ? "animate-pulse text-[color:var(--brand-green)]" : "text-muted-foreground"}`}
            />
            <div className="text-sm">
              <p className="font-medium">Share my location</p>
              <p className="text-xs text-muted-foreground">
                {sharing ? "Broadcasting now" : "Off — others can't see you"}
              </p>
            </div>
            <Switch checked={sharing} onCheckedChange={(v) => toggle(v)} />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <ClientOnly fallback={<div className="h-[560px] rounded-xl border bg-muted" />}>
            <LeafletMap center={center} markers={markers} height="560px" />
          </ClientOnly>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Users className="h-4 w-4" /> Live members
              </h2>
              <Badge variant="secondary">{people.length}</Badge>
            </div>
            {people.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nobody is sharing right now. Flip the switch above to appear on the map.
              </p>
            ) : (
              <div className="max-h-[500px] space-y-2 overflow-auto">
                {people.map((p) => (
                  <div key={p.user_id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-bold">
                      {(p.name ?? "?")[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">
                        {p.name ?? "Member"}{" "}
                        {p.user_id === user?.id && (
                          <Badge variant="outline" className="ml-1 text-[10px]">you</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!sharing && (
              <Button
                className="mt-4 w-full brand-gradient text-white"
                onClick={() => toggle(true)}
              >
                Start sharing my location
              </Button>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
