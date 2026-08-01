import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { LocationSearch } from "@/components/LocationSearch";
import { ClientOnly } from "@/components/ClientOnly";
import LeafletMap, { carIcon, pickupIcon } from "@/components/LeafletMap";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getRouteVia, formatDistance, formatDuration, type GeocodeResult, ZA_DEFAULT_CENTER } from "@/lib/geo";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Users, CircleSlash, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/group/$id")({
  head: () => ({
    meta: [
      { title: "Group route — LiftClub" },
      { name: "description", content: "Route, stops, members and live seat availability for this LiftClub commute group." },
      { property: "og:title", content: "Group route — LiftClub" },
      { property: "og:description", content: "Route, stops, members and live seat availability for this commute group." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupDetail,
});

function GroupDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newStop, setNewStop] = useState<GeocodeResult | null>(null);
  const [path, setPath] = useState<Array<[number, number]>>([]);
  const [routeMeta, setRouteMeta] = useState<{ d: number; t: number } | null>(null);

  const canManage = !!group && (isAdmin || group.created_by === user?.id);

  const load = async () => {
    const [{ data: g }, { data: s }, { data: m }, { data: r }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", id).maybeSingle(),
      supabase.from("group_stops").select("*").eq("group_id", id).order("seq"),
      supabase.from("group_members").select("*").eq("group_id", id),
      supabase.from("rides").select("*").eq("group_id", id).order("depart_at"),
    ]);
    setGroup(g);
    setStops(s ?? []);
    setMembers(m ?? []);
    setRides(r ?? []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      if (user) {
        const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
        setIsAdmin(!!data);
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  // Realtime: seat/full changes on this group's rides
  useEffect(() => {
    const ch = supabase
      .channel(`group-${id}-rides`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `group_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Draw the road path through origin → stops → destination
  useEffect(() => {
    if (!group) return;
    const pts = [
      { lat: group.origin_lat, lng: group.origin_lng },
      ...stops.map((s) => ({ lat: s.lat, lng: s.lng })),
      { lat: group.destination_lat, lng: group.destination_lng },
    ];
    let alive = true;
    getRouteVia(pts).then((r) => {
      if (!alive || !r) return;
      setPath(r.coords.map(([lng, lat]) => [lat, lng] as [number, number]));
      setRouteMeta({ d: r.distanceMeters, t: r.durationSeconds });
    });
    return () => { alive = false; };
  }, [group, stops]);

  const markers = useMemo(() => {
    if (!group) return [];
    return [
      { position: [group.origin_lat, group.origin_lng] as [number, number], icon: carIcon, popup: group.origin_label },
      ...stops.map((s) => ({ position: [s.lat, s.lng] as [number, number], icon: pickupIcon, popup: s.label })),
      { position: [group.destination_lat, group.destination_lng] as [number, number], popup: group.destination_label },
    ];
  }, [group, stops]);

  async function addStop() {
    if (!newStop) return;
    const { error } = await supabase.from("group_stops").insert({
      group_id: id, label: newStop.label, lat: newStop.lat, lng: newStop.lng, seq: stops.length,
    });
    if (error) return toast.error(error.message);
    setNewStop(null);
    toast.success("Stop added");
    await load();
  }

  async function removeStop(stopId: string) {
    const { error } = await supabase.from("group_stops").delete().eq("id", stopId);
    if (error) return toast.error(error.message);
    await load();
  }

  async function toggleFull(ride: any) {
    const { error } = await supabase.from("rides").update({ is_full: !ride.is_full }).eq("id", ride.id);
    if (error) return toast.error(error.message);
    toast.success(!ride.is_full ? "Marked full" : "Marked as taking riders");
    await load();
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!group) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="font-display text-2xl">Group not found</h1>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-widest text-[color:var(--steel)]">/ Group</p>
            <h1 className="font-display text-3xl tracking-tight">{group.name}</h1>
            <p className="text-sm text-muted-foreground">{group.origin_label} → {group.destination_label}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="capitalize">{group.vehicle_type}</Badge>
            <Badge variant="secondary"><Users className="mr-1 h-3 w-3" />{members.length}</Badge>
            {routeMeta && (
              <Badge className="font-mono-num bg-[color:var(--asphalt)] text-white">
                {formatDistance(routeMeta.d)} · {formatDuration(routeMeta.t)}
              </Badge>
            )}
          </div>
        </div>

        <ClientOnly fallback={<div className="h-[420px] rounded-xl border bg-muted" />}>
          <LeafletMap center={[group.origin_lat ?? ZA_DEFAULT_CENTER[0], group.origin_lng ?? ZA_DEFAULT_CENTER[1]]} markers={markers} polyline={path} height="420px" />
        </ClientOnly>

        {/* Stops */}
        <Card className="p-5">
          <h2 className="font-display text-xl">Stops along the way</h2>
          <ol className="mt-4 space-y-2">
            <li className="flex items-center gap-3 text-sm"><span className="font-mono-num text-xs text-[color:var(--steel)]">00</span>{group.origin_label}</li>
            {stops.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span className="font-mono-num text-xs text-[color:var(--steel)]">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1">{s.label}</span>
                {canManage && (
                  <Button size="icon" variant="ghost" onClick={() => removeStop(s.id)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </li>
            ))}
            <li className="flex items-center gap-3 text-sm"><span className="font-mono-num text-xs text-[color:var(--steel)]">{String(stops.length + 1).padStart(2, "0")}</span>{group.destination_label}</li>
          </ol>

          {canManage && (
            <div className="mt-5 space-y-2 border-t pt-4">
              <Label>Add a stop</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1"><LocationSearch value={newStop} onChange={setNewStop} placeholder="Search a pickup point…" /></div>
                <Button onClick={addStop} disabled={!newStop} className="bg-[color:var(--asphalt)] text-white">
                  <Plus className="mr-2 h-4 w-4" />Add stop
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Rides on this route */}
        <Card className="p-5">
          <h2 className="font-display text-xl">Trips on this route</h2>
          {rides.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No trips scheduled yet.</p>
          ) : (
            <div className="mt-4 divide-y">
              {rides.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-mono-num text-sm">{new Date(r.depart_at).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.seats_left}/{r.seats_total} seats left · R{Number(r.price_per_seat).toFixed(2)} per seat
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.is_full || r.seats_left <= 0 ? (
                      <Badge variant="destructive"><CircleSlash className="mr-1 h-3 w-3" />Full</Badge>
                    ) : (
                      <Badge className="bg-[color:var(--transit)] text-white"><CheckCircle2 className="mr-1 h-3 w-3" />Seats open</Badge>
                    )}
                    {r.driver_id === user?.id && (
                      <Button size="sm" variant="outline" onClick={() => toggleFull(r)} disabled={r.seats_left <= 0}>
                        {r.is_full ? "Reopen" : "Mark full"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
