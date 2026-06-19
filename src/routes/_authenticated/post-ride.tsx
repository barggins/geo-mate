import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocationSearch } from "@/components/LocationSearch";
import { ClientOnly } from "@/components/ClientOnly";
import LeafletMap, { pickupIcon } from "@/components/LeafletMap";
import { getRoute, coordsToWKT, pointToWKT, type GeocodeResult, formatDistance, formatDuration } from "@/lib/geo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Route as RouteIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/post-ride")({
  component: PostRide,
});

function PostRide() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [origin, setOrigin] = useState<GeocodeResult | null>(null);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [departAt, setDepartAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState(0);
  const [notes, setNotes] = useState("");
  const [route, setRoute] = useState<{ coords: [number, number][]; distanceMeters: number; durationSeconds: number } | null>(null);
  const [routing, setRouting] = useState(false);
  const [saving, setSaving] = useState(false);

  const computeRoute = async () => {
    if (!origin || !destination) return;
    setRouting(true);
    const r = await getRoute(origin, destination);
    setRouting(false);
    if (r) setRoute(r); else toast.error("Could not compute route");
  };

  const submit = async () => {
    if (!user || !origin || !destination) return;
    setSaving(true);
    if (!route) await computeRoute();
    const r = route ?? (await getRoute(origin, destination));
    const payload: any = {
      driver_id: user.id,
      origin_label: origin.label,
      destination_label: destination.label,
      origin: pointToWKT(origin),
      destination: pointToWKT(destination),
      origin_lat: origin.lat, origin_lng: origin.lng,
      destination_lat: destination.lat, destination_lng: destination.lng,
      route_line: r ? coordsToWKT(r.coords) : null,
      depart_at: new Date(departAt).toISOString(),
      seats_total: seats,
      seats_left: seats,
      price_per_seat: price,
      notes,
    };
    const { data, error } = await supabase.from("rides").insert(payload).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ride posted!");
    navigate({ to: "/ride/$id", params: { id: data!.id } });
  };

  const markers = [
    ...(origin ? [{ position: [origin.lat, origin.lng] as [number, number] }] : []),
    ...(destination ? [{ position: [destination.lat, destination.lng] as [number, number], icon: pickupIcon }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold">Post a ride</h1>
        <p className="mt-1 text-muted-foreground">Share your commute and pick up riders heading your way.</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label>From</Label>
              <LocationSearch value={origin} onChange={(v) => { setOrigin(v); setRoute(null); }} placeholder="Where do you start?" />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <LocationSearch value={destination} onChange={(v) => { setDestination(v); setRoute(null); }} placeholder="Where are you heading?" />
            </div>
            <Button type="button" variant="outline" disabled={!origin || !destination || routing} onClick={computeRoute} className="w-full">
              {routing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RouteIcon className="mr-2 h-4 w-4" />}
              Draw route
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="depart">Departure</Label>
                <Input id="depart" type="datetime-local" value={departAt} onChange={(e) => setDepartAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seats">Seats</Label>
                <Input id="seats" type="number" min={1} max={8} value={seats} onChange={(e) => setSeats(parseInt(e.target.value) || 1)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Suggested contribution per seat (R)</Label>
              <Input id="price" type="number" min={0} step="0.5" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. small bags only, dog friendly…" />
            </div>
            <Button onClick={submit} disabled={!origin || !destination || saving} className="w-full brand-gradient text-white">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Post ride
            </Button>
          </Card>

          <div className="space-y-3">
            <ClientOnly fallback={<div className="h-[420px] rounded-xl border bg-muted" />}>
              <LeafletMap
                center={origin ? [origin.lat, origin.lng] : [51.5074, -0.1278]}
                markers={markers}
                polyline={route?.coords.map(([lng, lat]) => [lat, lng])}
                height="420px"
              />
            </ClientOnly>
            {route && (
              <Card className="p-4">
                <div className="flex items-center justify-between text-sm">
                  <p><span className="font-semibold">Distance:</span> {formatDistance(route.distanceMeters)}</p>
                  <p><span className="font-semibold">Approx. duration:</span> {formatDuration(route.durationSeconds)}</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
