import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MapPin, Clock, Users, Bell, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { useVerification, canPostRide, canRequestSeat } from "@/lib/useVerification";
import { NextStepsPanel } from "@/components/NextStepsPanel";


export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const [myRides, setMyRides] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const verification = useVerification(user?.id);
  const role: "rider" | "driver" = verification.role ?? profile?.role ?? "rider";
  const postRide = canPostRide(verification);
  const seatRequest = canRequestSeat(verification);


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

  // Role themes — visually distinct, but consistent with the site identity.
  const theme = role === "driver"
    ? { bg: "bg-[#0F1720]", surface: "bg-[#141C27] text-slate-100 border-white/10", chip: "bg-amber-500/15 text-amber-300 border-amber-400/30", accent: "text-amber-400", avatar: "bg-gradient-to-br from-amber-400 to-orange-500 text-slate-900", header: "text-slate-100", muted: "text-slate-400", tag: "DRIVER CONSOLE" }
    : { bg: "bg-[#F6F5F1]", surface: "bg-white text-slate-900 border-slate-200", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", accent: "text-emerald-700", avatar: "bg-gradient-to-br from-emerald-400 to-teal-600 text-white", header: "text-slate-900", muted: "text-slate-500", tag: "RIDER LOUNGE" };


  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest ${theme.chip}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> {theme.tag}
            </span>
            <h1 className={`mt-3 text-3xl font-bold ${theme.header}`}>Hi {profile?.name ?? "there"} 👋</h1>
            <p className={`text-sm ${theme.muted}`}>
              {role === "driver" ? "Your rides, requests and earnings, at a glance." : "Find rides, track requests, ride safely."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/search"><Search className="mr-2 h-4 w-4" />Find a ride</Link></Button>
            {role === "driver" && (
              postRide.allowed ? (
                <Button asChild className="brand-gradient text-white"><Link to="/post-ride"><Plus className="mr-2 h-4 w-4" />Post a ride</Link></Button>
              ) : (
                <Button asChild variant="outline" title={postRide.reason}>
                  <Link to="/become-driver"><ShieldCheck className="mr-2 h-4 w-4" />Complete driver KYC</Link>
                </Button>
              )
            )}
            {role === "rider" && !verification.verified && (
              <Button asChild className="brand-gradient text-white"><Link to="/verify-identity"><ShieldCheck className="mr-2 h-4 w-4" />Verify identity</Link></Button>
            )}
          </div>
        </div>

        {!postRide.allowed && role === "driver" && (
          <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            {postRide.reason}
          </div>
        )}
        {role === "rider" && !seatRequest.allowed && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {seatRequest.reason}
          </div>
        )}



        <div className="grid gap-6 lg:grid-cols-3">
          {role === "driver" && (
            <Card className={`p-5 lg:col-span-2 ${theme.surface} animate-fade-in`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className={`h-4 w-4 ${theme.accent}`} />Incoming requests</h2>
                <Badge variant="secondary">{incomingRequests.length}</Badge>
              </div>
              {incomingRequests.length === 0 ? (
                <p className={`py-8 text-center text-sm ${theme.muted}`}>No new requests right now.</p>
              ) : (
                <div className="space-y-3">
                  {incomingRequests.map((r) => (
                    <Link key={r.id} to="/ride/$id" params={{ id: r.ride_id }} className="flex items-center gap-3 rounded-lg border border-white/10 p-3 transition-colors hover:bg-white/5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-bold text-slate-900">
                        {(r.profiles?.name ?? "?")[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{r.profiles?.name ?? "Rider"} wants to join</p>
                        <p className={`truncate text-xs ${theme.muted}`}>{r.rides?.origin_label} → {r.rides?.destination_label}</p>
                      </div>
                      <Badge>Pending</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card className={`p-5 ${theme.surface} animate-fade-in ${role === "rider" ? "lg:col-span-1" : ""}`}>
            <h2 className="mb-4 text-lg font-semibold">Your profile</h2>
            <div className="flex items-center gap-3">
              <div className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold ${theme.avatar}`}>
                {(profile?.name ?? user?.email ?? "?")[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{profile?.name ?? "Unnamed"}</p>
                <p className={`text-xs ${theme.muted}`}>⭐ {Number(profile?.rating ?? 5).toFixed(1)} · {profile?.rating_count ?? 0} reviews</p>
                <div className="mt-1 flex gap-1">
                  <Badge variant="outline" className="capitalize">{role}</Badge>
                  {profile?.verified && <Badge className="bg-emerald-600 text-white">Verified</Badge>}
                </div>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-4 w-full"><Link to="/profile">Edit profile</Link></Button>
          </Card>

          {role === "driver" && (
            <Card className={`p-5 lg:col-span-2 ${theme.surface} animate-fade-in`}>
              <h2 className="mb-4 text-lg font-semibold">Rides you're driving</h2>
              {myRides.length === 0 ? (
                <p className={`py-8 text-center text-sm ${theme.muted}`}>You haven't posted a ride yet.</p>
              ) : (
                <div className="space-y-3">
                  {myRides.map((r) => (
                    <Link key={r.id} to="/ride/$id" params={{ id: r.id }} className="flex items-center gap-4 rounded-lg border border-white/10 p-3 hover:bg-white/5">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${theme.avatar}`}><MapPin className="h-4 w-4" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{r.origin_label} → {r.destination_label}</p>
                        <p className={`text-xs ${theme.muted}`}><Clock className="mr-1 inline h-3 w-3" />{format(new Date(r.depart_at), "EEE d MMM, HH:mm")}</p>
                      </div>
                      <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{r.seats_left}/{r.seats_total}</Badge>
                      <Badge variant={r.status === "scheduled" ? "secondary" : "default"}>{r.status}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card className={`p-5 ${theme.surface} animate-fade-in ${role === "rider" ? "lg:col-span-2" : ""}`}>
            <h2 className="mb-4 text-lg font-semibold">Your seat requests</h2>
            {myRequests.length === 0 ? (
              <p className={`py-8 text-center text-sm ${theme.muted}`}>
                {role === "rider" ? "No requests yet — find a ride!" : "No requests yet."}
              </p>
            ) : (
              <div className="space-y-3">
                {myRequests.map((r) => (
                  <Link key={r.id} to="/ride/$id" params={{ id: r.ride_id }} className="block rounded-lg border border-white/10 p-3 hover:bg-white/5">
                    <p className="truncate text-sm font-medium">{r.rides?.origin_label} → {r.rides?.destination_label}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className={`text-xs ${theme.muted}`}>{format(new Date(r.rides?.depart_at), "EEE HH:mm")}</p>
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

