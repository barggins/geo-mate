import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LocationSearch } from "@/components/LocationSearch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { GeocodeResult } from "@/lib/geo";
import { toast } from "sonner";
import { Bus, Car, Loader2, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({
    meta: [
      { title: "Commute groups — LiftClub" },
      { name: "description", content: "Join a LiftClub commute group: fixed routes with stops, live tracking and seat availability." },
      { property: "og:title", content: "Commute groups — LiftClub" },
      { property: "og:description", content: "Fixed commuter routes with stops, live tracking and seat availability." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupsPage,
});

const VEHICLES = ["car", "van", "bus", "taxi"] as const;

function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myIds, setMyIds] = useState<Set<string>>(new Set());
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // form
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [vehicle, setVehicle] = useState<(typeof VEHICLES)[number]>("car");
  const [origin, setOrigin] = useState<GeocodeResult | null>(null);
  const [dest, setDest] = useState<GeocodeResult | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase.from("group_members").select("group_id, user_id"),
    ]);
    setGroups(g ?? []);
    const c: Record<string, number> = {};
    const mine = new Set<string>();
    (m ?? []).forEach((row: any) => {
      c[row.group_id] = (c[row.group_id] ?? 0) + 1;
      if (row.user_id === user?.id) mine.add(row.group_id);
    });
    setCounts(c);
    setMyIds(mine);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: admin }, { data: app }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase.from("driver_applications").select("status").eq("user_id", user.id).maybeSingle(),
      ]);
      setCanCreate(!!admin || app?.status === "approved");
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function createGroup() {
    if (!user || !name.trim() || !origin || !dest) {
      toast.error("Name, start point and destination are required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("groups").insert({
      name: name.trim(),
      description: desc.trim() || null,
      vehicle_type: vehicle,
      origin_label: origin.label,
      origin_lat: origin.lat,
      origin_lng: origin.lng,
      destination_label: dest.label,
      destination_lat: dest.lat,
      destination_lng: dest.lng,
      created_by: user.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Group created — add your stops next.");
    setShowForm(false);
    setName(""); setDesc(""); setOrigin(null); setDest(null);
    await load();
  }

  async function toggleJoin(groupId: string) {
    if (!user) return;
    if (myIds.has(groupId)) {
      const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
      if (error) return toast.error(error.message);
      toast.success("Left group");
    } else {
      const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id });
      if (error) return toast.error(error.message);
      toast.success("Joined group");
    }
    await load();
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-widest text-[color:var(--steel)]">/ Commute groups</p>
            <h1 className="font-display text-3xl tracking-tight">Routes people ride every day</h1>
          </div>
          {canCreate && (
            <Button className="bg-[color:var(--signal)] font-semibold text-[color:var(--asphalt)] hover:bg-[color:var(--signal)]" onClick={() => setShowForm((s) => !s)}>
              <Plus className="mr-2 h-4 w-4" />New group
            </Button>
          )}
        </div>

        {showForm && (
          <Card className="mb-8 space-y-4 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Group name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Soweto → Sandton morning run" />
              </div>
              <div className="space-y-2">
                <Label>Vehicle type</Label>
                <div className="flex gap-2">
                  {VEHICLES.map((v) => (
                    <Button key={v} type="button" size="sm" variant={vehicle === v ? "default" : "outline"}
                      className={vehicle === v ? "bg-[color:var(--asphalt)] capitalize text-white" : "capitalize"}
                      onClick={() => setVehicle(v)}>{v}</Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Start point</Label>
                <LocationSearch value={origin} onChange={setOrigin} placeholder="Where the route starts" />
              </div>
              <div className="space-y-2">
                <Label>Destination</Label>
                <LocationSearch value={dest} onChange={setDest} placeholder="Where the route ends" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Departure times, rules, fare guidance…" />
              </div>
            </div>
            <Button disabled={saving} onClick={createGroup} className="bg-[color:var(--asphalt)] text-white">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create group
            </Button>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : groups.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">No groups yet.</Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((g) => (
              <Card key={g.id} className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg">{g.name}</h2>
                    <p className="text-xs text-muted-foreground">{g.origin_label.split(",")[0]} → {g.destination_label.split(",")[0]}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {g.vehicle_type === "bus" ? <Bus className="mr-1 h-3 w-3" /> : <Car className="mr-1 h-3 w-3" />}
                    {g.vehicle_type}
                  </Badge>
                </div>
                {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />{counts[g.id] ?? 0} members
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/group/$id" params={{ id: g.id }}>Open</Link>
                    </Button>
                    <Button size="sm" variant={myIds.has(g.id) ? "outline" : "default"}
                      className={myIds.has(g.id) ? "" : "bg-[color:var(--transit)] text-white hover:bg-[color:var(--transit)]"}
                      onClick={() => toggleJoin(g.id)}>
                      {myIds.has(g.id) ? "Leave" : "Join"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
