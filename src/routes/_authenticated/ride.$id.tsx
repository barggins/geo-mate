import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ClientOnly } from "@/components/ClientOnly";
import LeafletMap, { carIcon, pickupIcon } from "@/components/LeafletMap";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Loader2, MapPin, Clock, Users, Star, Send, Play, Square, Radio, MessageCircle, Check, X,
} from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/ride/$id")({
  component: RidePage,
});

function RidePage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [ride, setRide] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [myRequest, setMyRequest] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [liveLoc, setLiveLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);

  const isDriver = user && ride && user.id === ride.driver_id;

  const load = async () => {
    const { data: r } = await supabase.from("rides").select("*").eq("id", id).single();
    if (!r) return;
    setRide(r);
    const { data: p } = await supabase.from("profiles").select("*").eq("id", r.driver_id).single();
    setDriver(p);
    const { data: reqs } = await supabase
      .from("ride_requests")
      .select("*, profiles!ride_requests_rider_id_fkey(name, photo_url, rating, verified)")
      .eq("ride_id", id)
      .order("created_at", { ascending: false });
    setRequests(reqs ?? []);
    setMyRequest((reqs ?? []).find((x) => x.rider_id === user?.id) ?? null);
    const { data: lastLoc } = await supabase
      .from("locations").select("*").eq("ride_id", id).order("recorded_at", { ascending: false }).limit(1).maybeSingle();
    if (lastLoc) setLiveLoc({ lat: lastLoc.lat, lng: lastLoc.lng });
    const { data: rvs } = await supabase.from("reviews").select("*, profiles!reviews_from_user_fkey(name)").eq("ride_id", id);
    setReviews(rvs ?? []);
  };

  useEffect(() => { if (user) load(); }, [id, user]);

  // realtime channels
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`ride-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests", filter: `ride_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `id=eq.${id}` }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `ride_id=eq.${id}` }, (payload) => {
        setMessages((m) => [...m, payload.new as any]);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "locations", filter: `ride_id=eq.${id}` }, (payload) => {
        const n = payload.new as any;
        setLiveLoc({ lat: n.lat, lng: n.lng });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user]);

  // messages (only after we know we can read them)
  useEffect(() => {
    if (!ride || !user) return;
    supabase.from("messages").select("*").eq("ride_id", id).order("created_at", { ascending: true }).then(({ data }) => setMessages(data ?? []));
  }, [ride, user, id]);

  if (!ride) {
    return (
      <div className="min-h-screen bg-background"><Header />
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Header card */}
        <Card className="overflow-hidden p-0">
          <div className="brand-gradient p-6 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase opacity-80">{format(new Date(ride.depart_at), "EEEE d MMM · HH:mm")}</p>
                <h1 className="mt-1 text-2xl font-bold md:text-3xl">{ride.origin_label.split(",")[0]} → {ride.destination_label.split(",")[0]}</h1>
                <p className="mt-1 text-sm opacity-80">{ride.origin_label} → {ride.destination_label}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-white/20 text-white"><Users className="mr-1 h-3 w-3" />{ride.seats_left}/{ride.seats_total} seats</Badge>
                <Badge className="bg-white/20 text-white">£{Number(ride.price_per_seat).toFixed(2)}</Badge>
                <Badge className="bg-white text-[color:var(--brand-blue)]">{ride.status}</Badge>
              </div>
            </div>
            {driver && (
              <div className="mt-4 flex items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 font-bold">{driver.name?.[0]}</div>
                  <div>
                    <p className="text-sm font-medium">{driver.name} {driver.verified && <Badge variant="secondary" className="ml-1 text-[10px]">Verified</Badge>}</p>
                    <p className="text-xs opacity-80"><Star className="mr-1 inline h-3 w-3 fill-current" />{Number(driver.rating ?? 5).toFixed(1)} · {driver.rating_count ?? 0} reviews</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Map */}
          <div className="space-y-4">
            <ClientOnly fallback={<div className="h-[460px] rounded-xl border bg-muted" />}>
              <RideMap ride={ride} liveLoc={liveLoc} />
            </ClientOnly>

            {ride.notes && <Card className="p-4 text-sm"><span className="font-semibold">Driver notes: </span>{ride.notes}</Card>}

            {/* Driver controls */}
            {isDriver && ride.status !== "completed" && ride.status !== "cancelled" && (
              <Card className="p-4">
                <div className="flex flex-wrap gap-2">
                  {ride.status === "scheduled" && (
                    <Button onClick={async () => {
                      await supabase.from("rides").update({ status: "in_progress" }).eq("id", id);
                      toast.success("Ride started — broadcasting your location.");
                    }}>
                      <Play className="mr-2 h-4 w-4" />Start ride
                    </Button>
                  )}
                  {ride.status === "in_progress" && (
                    <>
                      <LiveTrackingToggle rideId={id} driverId={user!.id} />
                      <Button variant="default" onClick={async () => {
                        await supabase.from("rides").update({ status: "completed" }).eq("id", id);
                        toast.success("Ride completed!");
                      }}>
                        <Square className="mr-2 h-4 w-4" />Complete
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={async () => {
                    if (!confirm("Cancel this ride?")) return;
                    await supabase.from("rides").update({ status: "cancelled" }).eq("id", id);
                    toast.message("Ride cancelled");
                  }}>Cancel</Button>
                </div>
              </Card>
            )}

            {/* Driver: incoming requests */}
            {isDriver && (
              <Card className="p-5">
                <h2 className="mb-3 text-lg font-semibold">Requests ({requests.length})</h2>
                {requests.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
                <div className="space-y-2">
                  {requests.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-bold">{r.profiles?.name?.[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{r.profiles?.name} · ⭐ {Number(r.profiles?.rating ?? 5).toFixed(1)}</p>
                        {r.message && <p className="truncate text-xs text-muted-foreground">"{r.message}"</p>}
                      </div>
                      {r.status === "pending" ? (
                        <>
                          <Button size="sm" variant="default" className="brand-gradient text-white" onClick={async () => {
                            const { error } = await supabase.rpc("accept_ride_request", { p_request_id: r.id });
                            if (error) toast.error(error.message); else toast.success("Accepted");
                          }}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={async () => {
                            await supabase.from("ride_requests").update({ status: "rejected" }).eq("id", r.id);
                          }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant={r.status === "accepted" ? "default" : "secondary"}>{r.status}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Rider: request seat or status */}
            {!isDriver && (
              <RiderRequestPanel ride={ride} myRequest={myRequest} userId={user!.id} onChange={load} />
            )}
          </div>

          {/* Chat + reviews */}
          <div className="space-y-4">
            {(isDriver || myRequest?.status === "accepted") && (
              <Chat rideId={id} userId={user!.id} messages={messages} />
            )}
            {ride.status === "completed" && !isDriver && myRequest?.status === "accepted" && (
              <ReviewForm rideId={id} fromUser={user!.id} toUser={ride.driver_id} existing={reviews.find((rv) => rv.from_user === user!.id)} />
            )}
            {reviews.length > 0 && (
              <Card className="p-5">
                <h3 className="mb-2 font-semibold">Reviews</h3>
                <div className="space-y-2">
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">{r.profiles?.name} · ⭐ {r.rating}</p>
                      {r.body && <p className="text-muted-foreground">{r.body}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function RideMap({ ride, liveLoc }: { ride: any; liveLoc: { lat: number; lng: number } | null }) {
  const origin: [number, number] | null =
    ride.origin_lat != null && ride.origin_lng != null ? [ride.origin_lat, ride.origin_lng] : null;
  const destination: [number, number] | null =
    ride.destination_lat != null && ride.destination_lng != null ? [ride.destination_lat, ride.destination_lng] : null;

  const markers = [
    ...(origin ? [{ position: origin }] : []),
    ...(destination ? [{ position: destination, icon: pickupIcon }] : []),
    ...(liveLoc ? [{ position: [liveLoc.lat, liveLoc.lng] as [number, number], icon: carIcon }] : []),
  ];

  const polyline: Array<[number, number]> | undefined =
    origin && destination ? [origin, destination] : undefined;

  return (
    <LeafletMap
      center={liveLoc ? [liveLoc.lat, liveLoc.lng] : origin ?? [51.5074, -0.1278]}
      markers={markers}
      polyline={polyline}
      height="460px"
    />
  );
}

function LiveTrackingToggle({ rideId, driverId }: { rideId: string; driverId: string }) {
  const [on, setOn] = useState(false);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!on) return;
    if (!navigator.geolocation) { toast.error("Geolocation unsupported"); setOn(false); return; }
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        await supabase.from("locations").insert({
          ride_id: rideId, driver_id: driverId,
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          heading: pos.coords.heading ?? null,
          speed_kmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
        });
      },
      (err) => { toast.error(err.message); setOn(false); },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
    return () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); };
  }, [on, rideId, driverId]);

  return (
    <Button variant={on ? "default" : "outline"} onClick={() => setOn((v) => !v)}>
      <Radio className={`mr-2 h-4 w-4 ${on ? "animate-pulse text-[color:var(--brand-green)]" : ""}`} />
      {on ? "Broadcasting…" : "Start live tracking"}
    </Button>
  );
}

function RiderRequestPanel({ ride, myRequest, userId, onChange }: { ride: any; myRequest: any; userId: string; onChange: () => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (myRequest) {
    return (
      <Card className="p-5">
        <h2 className="text-lg font-semibold">Your request</h2>
        <p className="mt-1 text-sm">Status: <Badge variant={myRequest.status === "accepted" ? "default" : myRequest.status === "rejected" ? "destructive" : "secondary"}>{myRequest.status}</Badge></p>
        {myRequest.status === "pending" && (
          <Button variant="outline" className="mt-3" onClick={async () => {
            await supabase.from("ride_requests").update({ status: "cancelled" }).eq("id", myRequest.id);
            onChange();
          }}>Cancel request</Button>
        )}
      </Card>
    );
  }

  if (ride.seats_left <= 0 || ride.status !== "scheduled") {
    return <Card className="p-5 text-sm text-muted-foreground">This ride isn't accepting requests right now.</Card>;
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Request a seat</h2>
      <Textarea className="mt-3" placeholder="Optional message to the driver" value={message} onChange={(e) => setMessage(e.target.value)} />
      <Button className="mt-3 w-full brand-gradient text-white" disabled={busy} onClick={async () => {
        setBusy(true);
        const { error } = await supabase.from("ride_requests").insert({
          ride_id: ride.id, rider_id: userId, message: message || null,
        });
        setBusy(false);
        if (error) toast.error(error.message); else { toast.success("Request sent!"); onChange(); }
      }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send request"}
      </Button>
    </Card>
  );
}

function Chat({ rideId, userId, messages }: { rideId: string; userId: string; messages: any[] }) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages]);

  return (
    <Card className="flex h-[460px] flex-col p-0">
      <div className="border-b p-4"><h3 className="flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4" />Ride chat</h3></div>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto p-4">
        {messages.length === 0 && <p className="text-center text-sm text-muted-foreground">No messages yet — say hi 👋</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === userId ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.sender_id === userId ? "brand-gradient text-white" : "bg-secondary"}`}>
              {m.body}
            </div>
          </div>
        ))}
      </div>
      <form className="flex gap-2 border-t p-3" onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const body = text; setText("");
        const { error } = await supabase.from("messages").insert({ ride_id: rideId, sender_id: userId, body });
        if (error) toast.error(error.message);
      }}>
        <Input placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" size="icon" className="brand-gradient text-white"><Send className="h-4 w-4" /></Button>
      </form>
    </Card>
  );
}

function ReviewForm({ rideId, fromUser, toUser, existing }: { rideId: string; fromUser: string; toUser: string; existing: any }) {
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [body, setBody] = useState(existing?.body ?? "");
  if (existing) {
    return <Card className="p-5"><p className="text-sm text-muted-foreground">You rated this ride ⭐ {existing.rating}</p></Card>;
  }
  return (
    <Card className="p-5">
      <h3 className="font-semibold">Rate your driver</h3>
      <div className="my-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} type="button">
            <Star className={`h-7 w-7 ${n <= rating ? "fill-[color:var(--brand-blue)] text-[color:var(--brand-blue)]" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      <Textarea placeholder="Optional comment" value={body} onChange={(e) => setBody(e.target.value)} />
      <Button className="mt-3 brand-gradient text-white" onClick={async () => {
        const { error } = await supabase.from("reviews").insert({ ride_id: rideId, from_user: fromUser, to_user: toUser, rating, body: body || null });
        if (error) toast.error(error.message); else toast.success("Review submitted!");
      }}>Submit review</Button>
    </Card>
  );
}
