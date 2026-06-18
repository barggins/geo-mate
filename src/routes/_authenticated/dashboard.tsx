import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MapPin, Clock, Users, Bell } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const [myRides, setMyRides] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: rides }, { data: profileData }] = await Promise.all([
        supabase.from("rides").select("*").eq("driver_id", user.id).order("depart_at", { ascending: true }).limit(10),
        supabase.from("profiles").select("*").eq("id", user.id).single(),
      ]);
      setMyRides(rides ?? []);
      setProfile(profileData);

      // requests on my rides
      const rideIds = (rides ?? []).map((r) => r.id);
      if (rideIds.length) {
        const { data: incoming } = await supabase
          .from("ride_requests")
          .select("*, profiles!ride_requests_rider_id_fkey(name, photo_url, rating), rides(origin_label, destination_label, depart_at)")
          .in("ride_id", rideIds)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        setIncomingRequests(incoming ?? []);
      }

      // my requests
      const { data: mine } = await supabase
        .from("ride_requests")
        .select("*, rides(origin_label, destination_label, depart_at, driver_id)")
        .eq("rider_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setMyRequests(mine ?? []);
    };
    load();

    const channel = supabase
      .channel(`dash-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Hi {profile?.name ?? "there"} 👋</h1>
            <p className="text-muted-foreground">Your commute, all in one place.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to="/search"><Search className="mr-2 h-4 w-4" />Find a ride</Link></Button>
            <Button asChild className="brand-gradient text-white"><Link to="/post-ride"><Plus className="mr-2 h-4 w-4" />Post a ride</Link></Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Incoming requests */}
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className="h-4 w-4 text-[color:var(--brand-blue)]" />Incoming requests</h2>
              <Badge variant="secondary">{incomingRequests.length}</Badge>
            </div>
            {incomingRequests.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No new requests right now.</p>
            ) : (
              <div className="space-y-3">
                {incomingRequests.map((r) => (
                  <Link
                    key={r.id}
                    to="/ride/$id"
                    params={{ id: r.ride_id }}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/30"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-bold">
                      {(r.profiles?.name ?? "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{r.profiles?.name ?? "Rider"} wants to join</p>
                      <p className="truncate text-xs text-muted-foreground">{r.rides?.origin_label} → {r.rides?.destination_label}</p>
                    </div>
                    <Badge>Pending</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* My profile snapshot */}
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold">Your profile</h2>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full brand-gradient text-xl font-bold text-white">
                {(profile?.name ?? user?.email ?? "?")[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{profile?.name ?? "Unnamed"}</p>
                <p className="text-xs text-muted-foreground">⭐ {Number(profile?.rating ?? 5).toFixed(1)} · {profile?.rating_count ?? 0} reviews</p>
                {profile?.verified && <Badge variant="secondary" className="mt-1">Verified</Badge>}
              </div>
            </div>
            <Button asChild variant="outline" className="mt-4 w-full"><Link to="/profile">Edit profile</Link></Button>
          </Card>

          {/* My posted rides */}
          <Card className="p-5 lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">Rides you're driving</h2>
            {myRides.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">You haven't posted a ride yet.</p>
            ) : (
              <div className="space-y-3">
                {myRides.map((r) => (
                  <Link key={r.id} to="/ride/$id" params={{ id: r.id }} className="flex items-center gap-4 rounded-lg border p-3 hover:bg-accent/30">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg brand-gradient text-white"><MapPin className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{r.origin_label} → {r.destination_label}</p>
                      <p className="text-xs text-muted-foreground"><Clock className="mr-1 inline h-3 w-3" />{format(new Date(r.depart_at), "EEE d MMM, HH:mm")}</p>
                    </div>
                    <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{r.seats_left}/{r.seats_total}</Badge>
                    <Badge variant={r.status === "scheduled" ? "secondary" : "default"}>{r.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* My requests */}
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold">Your seat requests</h2>
            {myRequests.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No requests yet — find a ride!</p>
            ) : (
              <div className="space-y-3">
                {myRequests.map((r) => (
                  <Link key={r.id} to="/ride/$id" params={{ id: r.ride_id }} className="block rounded-lg border p-3 hover:bg-accent/30">
                    <p className="truncate text-sm font-medium">{r.rides?.origin_label} → {r.rides?.destination_label}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{format(new Date(r.rides?.depart_at), "EEE HH:mm")}</p>
                      <Badge variant={r.status === "accepted" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
