import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Fuel, Leaf, TrendingDown, Info } from "lucide-react";

export const Route = createFileRoute("/fuel-calculator")({
  head: () => ({
    meta: [
      { title: "Fuel Savings Calculator — LiftClub" },
      { name: "description", content: "Work out what your daily commute costs in petrol or diesel, and how much you save by sharing the ride with other South African commuters." },
      { property: "og:title", content: "Fuel Savings Calculator — LiftClub" },
      { property: "og:description", content: "See your monthly fuel cost, CO2 output and what carpooling saves you every year." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FuelCalculator,
});

const FUEL_PRICE = { petrol: 25.42, diesel: 26.41 } as const;

const VEHICLES = [
  { label: "Small hatchback", lp100: 6.5 },
  { label: "Sedan", lp100: 8.0 },
  { label: "SUV / crossover", lp100: 10.5 },
  { label: "Bakkie / double cab", lp100: 11.5 },
  { label: "Minibus / taxi", lp100: 13.0 },
];

function rands(n: number) {
  return "R" + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function FuelCalculator() {
  const [fuel, setFuel] = useState<"petrol" | "diesel">("petrol");
  const [km, setKm] = useState(40);
  const [vehicle, setVehicle] = useState(1);
  const [trips, setTrips] = useState(5);
  const [sharing, setSharing] = useState(2);
  const [contribution, setContribution] = useState(0);

  const r = useMemo(() => {
    const lp100 = VEHICLES[vehicle]?.lp100 ?? 8;
    const litres = (km * trips * 4.33 * lp100) / 100;
    const cost = litres * FUEL_PRICE[fuel];
    const share = Math.max(1, sharing + 1);
    const shared = cost / share - contribution;
    const savings = Math.max(0, cost - Math.max(0, shared));
    return {
      litres,
      cost,
      shared: Math.max(0, shared),
      savings,
      annual: savings * 12,
      co2: litres * 2.31,
      trees: Math.round((litres * 2.31 * 12) / 21),
    };
  }, [fuel, km, vehicle, trips, sharing, contribution]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <section className="border-b bg-[color:var(--asphalt)] text-white">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">Tools</p>
          <h1 className="mt-2 font-display text-3xl text-white md:text-5xl">Fuel savings calculator</h1>
          <p className="mt-3 max-w-xl text-sm text-white/70">
            Petrol 93 at <span className="font-mono-num">{rands(FUEL_PRICE.petrol)}/L</span> · Diesel 50ppm at{" "}
            <span className="font-mono-num">{rands(FUEL_PRICE.diesel)}/L</span>. Change the inputs to see what sharing your commute puts back in your pocket.
          </p>
        </div>
      </section>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[380px_1fr]">
        {/* Inputs */}
        <Card className="h-fit space-y-5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Fuel className="h-4 w-4 text-[color:var(--signal)]" /> Your commute
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["petrol", "diesel"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFuel(f)}
                className={`rounded-md border px-3 py-2 text-sm font-medium capitalize transition ${
                  fuel === f
                    ? "border-[color:var(--signal)] bg-[color:var(--sky-tint)] text-[color:var(--signal)]"
                    : "hover:bg-accent/50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="km">Daily distance (km, return trip)</Label>
            <Input id="km" type="number" min={0} value={km} onChange={(e) => setKm(Number(e.target.value) || 0)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="veh">Vehicle type</Label>
            <select
              id="veh"
              value={vehicle}
              onChange={(e) => setVehicle(Number(e.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {VEHICLES.map((v, i) => (
                <option key={v.label} value={i}>
                  {v.label} ({v.lp100} L/100km)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="trips">Trips per week</Label>
              <span className="rounded bg-[color:var(--asphalt)] px-2 py-0.5 font-mono-num text-xs text-white">{trips}</span>
            </div>
            <input id="trips" type="range" min={1} max={7} value={trips} onChange={(e) => setTrips(Number(e.target.value))} className="w-full accent-[color:var(--signal)]" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="share">People sharing with you</Label>
              <span className="rounded bg-[color:var(--success)] px-2 py-0.5 font-mono-num text-xs text-white">{sharing}</span>
            </div>
            <input id="share" type="range" min={0} max={6} value={sharing} onChange={(e) => setSharing(Number(e.target.value))} className="w-full accent-[color:var(--success)]" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contrib">Monthly passenger contribution (R) — optional</Label>
            <Input id="contrib" type="number" min={0} value={contribution} onChange={(e) => setContribution(Number(e.target.value) || 0)} />
          </div>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Monthly fuel cost" value={rands(r.cost)} tone="dark" />
            <Stat label="Fuel used / month" value={`${r.litres.toFixed(1)} L`} tone="light" />
            <Stat label="Monthly savings" value={rands(r.savings)} tone="blue" />
            <Stat label="Annual savings" value={rands(r.annual)} tone="green" />
          </div>

          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <TrendingDown className="h-4 w-4 text-[color:var(--signal)]" /> Driving alone vs LiftClub
            </div>
            <Bar label="Driving alone" value={r.cost} max={r.cost || 1} color="var(--asphalt)" />
            <Bar label="With LiftClub" value={r.shared} max={r.cost || 1} color="var(--signal)" />
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">CO₂ per month</p>
                <p className="font-mono-num text-2xl">{r.co2.toFixed(1)} kg</p>
              </div>
              <Leaf className="h-8 w-8 text-[color:var(--success)]" />
            </Card>
            <Card className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Trees equivalent / year</p>
                <p className="font-mono-num text-2xl">{r.trees}</p>
              </div>
              <Leaf className="h-8 w-8 text-[color:var(--success)]" />
            </Card>
          </div>

          <div className="flex flex-col items-start gap-3 rounded-lg border border-[color:var(--signal)]/25 bg-[color:var(--sky-tint)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              Ready to actually save it? Browse commuters already driving your route.
            </p>
            <Button asChild className="brand-gradient">
              <Link to="/liftclubs">Browse lift clubs</Link>
            </Button>
          </div>

          <p className="flex items-start gap-2 rounded-md border bg-card p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Estimates only, based on average consumption figures, current pump prices and 4.33 weeks per month. Your real costs vary with traffic, driving style and vehicle condition.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "dark" | "light" | "blue" | "green" }) {
  const styles = {
    dark: "bg-[color:var(--asphalt)] text-white",
    light: "bg-card",
    blue: "bg-[color:var(--signal)] text-white",
    green: "bg-[color:var(--success)] text-white",
  }[tone];
  return (
    <div className={`rounded-lg border p-5 ${styles}`}>
      <p className="text-[11px] uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-1 font-mono-num text-2xl">{value}</p>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(3, (value / max) * 100));
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono-num">{rands(value)}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: `var(--x, ${color})` }} />
      </div>
    </div>
  );
}
