import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LocationSearch } from "@/components/LocationSearch";
import { ClientOnly } from "@/components/ClientOnly";
import LeafletMap from "@/components/LeafletMap";
import { AvatarImg } from "@/components/AvatarImg";
import { supabase } from "@/integrations/supabase/client";
import type { GeocodeResult } from "@/lib/geo";
import { formatDistance } from "@/lib/geo";
import { toast } from "sonner";
import { Loader2, Search as SearchIcon, Star, Users, Clock } from "lucide-react";
import { format } from "date-fns";

// Weighted match score: rating dominates, light penalty for detour + late departures.
function scoreRide(r: any) {
  const rating = Number(r.driver_rating ?? 0); // 0–5
  const detourKm = ((Number(r.pickup_distance_m ?? 0) + Number(r.dropoff_distance_m ?? 0)) / 1000);
  const hours = Math.max(0, (new Date(r.depart_at).getTime() - Date.now()) / 3600000);
  return rating * 1.0 - detourKm * 0.05 - Math.min(hours, 72) * 0.01;
}

export const Route = createFileRoute("/_authenticated/search")({
  component: Search,
});

function Search() {
  const [pickup, setPickup] = useState<GeocodeResult | null>(null);
  const [dropoff, setDropoff] = useState<GeocodeResult | null>(null);
  const [radius, setRadius] = useState(3);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = async () => {
    if (!pickup || !dropoff) { toast.error("Pick both pickup and dropoff"); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc("search_rides", {
      pickup_lat: pickup.lat, pickup_lng: pickup.lng,
      dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      radius_m: radius * 1000,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const sorted = [...(data ?? [])].sort((a, b) => scoreRide(b) - scoreRide(a));
    setResults(sorted);
    if (!data?.length) toast.message("No rides match yet — try widening the radius.");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold">Find a ride</h1>
        <p className="text-muted-foreground">We'll find drivers whose route passes within walking distance of your pickup and dropoff.</p>

        <Card className="mt-6 grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto_auto]">
          <div className="space-y-1.5">
            <Label>Pickup</Label>
            <LocationSearch value={pickup} onChange={setPickup} placeholder="Where are you starting?" />
          </div>
          <div className="space-y-1.5">
            <Label>Dropoff</Label>
            <LocationSearch value={dropoff} onChange={setDropoff} placeholder="Where are you going?" />
          </div>
          <div className="space-y-1.5">
            <Label>Radius (km)</Label>
            <Input type="number" min={1} max={20} value={radius} onChange={(e) => setRadius(parseInt(e.target.value) || 3)} className="w-24" />
          </div>
          <div className="flex items-end">
            <Button onClick={runSearch} disabled={loading} className="brand-gradient text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><SearchIcon className="mr-2 h-4 w-4" />Search</>}
            </Button>
          </div>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            {results.length === 0 && !loading && (
              <Card className="p-10 text-center text-sm text-muted-foreground">Search to see matching rides here.</Card>
            )}
            {results.map((r) => (
              <Link key={r.id} to="/ride/$id" params={{ id: r.id }}>
                <Card className="p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-start gap-4">
                    <AvatarImg path={r.driver_photo} name={r.driver_name} size={48} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold">{r.origin_label.split(",")[0]} → {r.destination_label.split(",")[0]}</p>
                        <Badge className="brand-gradient text-white">R{Number(r.price_per_seat).toFixed(2)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.driver_name} · ⭐ {Number(r.driver_rating).toFixed(1)}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(r.depart_at), "EEE d MMM, HH:mm")}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.seats_left} seats left</span>
                        <span>Pickup detour: {formatDistance(r.pickup_distance_m)}</span>
                        <span>Dropoff detour: {formatDistance(r.dropoff_distance_m)}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          <div className="lg:sticky lg:top-20 lg:self-start">
            <ClientOnly fallback={<div className="h-[420px] rounded-xl border bg-muted" />}>
              <LeafletMap
                center={pickup ? [pickup.lat, pickup.lng] : [51.5074, -0.1278]}
                markers={[
                  ...(pickup ? [{ position: [pickup.lat, pickup.lng] as [number, number] }] : []),
                  ...(dropoff ? [{ position: [dropoff.lat, dropoff.lng] as [number, number] }] : []),
                ]}
                height="500px"
              />
            </ClientOnly>
          </div>
        </div>
      </main>
    </div>
  );
}
