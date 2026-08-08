import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useVerification } from "@/lib/useVerification";
import { MapPin, ArrowRight, Users, Lock, Search, Loader2 } from "lucide-react";

export const Route = createFileRoute("/liftclubs")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lift clubs & rides on your route — LiftClub" },
      { name: "description", content: "Browse live commuter lift clubs and scheduled rides across South Africa. Sign in and complete verification to book a seat." },
      { property: "og:title", content: "Lift clubs & rides on your route — LiftClub" },
      { property: "og:description", content: "Live commuter lift clubs and scheduled rides across South Africa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Liftclubs,
});

type Ride = {
  id: string;
  origin_label: string;
  destination_label: string;
  depart_at: string;
  price_per_seat: number;
  seats_left: number;
  vehicle_type: string;
  is_full: boolean;
};

type Group = {
  id: string;
  name: string;
  origin_label: string;
  destination_label: string;
  vehicle_type: string;
  description: string | null;
};

function Liftclubs() {
  const { user } = useAuth();
  const v = useVerification(user?.id);
  const [rides, setRides] = useState<Ride[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"rides" | "clubs">("rides");

  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: g }] = await Promise.all([
        supabase
          .from("rides")
          .select("id, origin_label, destination_label, depart_at, price_per_seat, seats_left, vehicle_type, is_full")
          .eq("status", "scheduled")
          .order("depart_at", { ascending: true })
          .limit(60),
        supabase
          .from("groups")
          .select("id, name, origin_label, destination_label, vehicle_type, description")
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(60),
      ]);
      setRides((r as Ride[]) ?? []);
      setGroups((g as Group[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const match = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase());
  const shownRides = rides.filter((r) => !q || match(r.origin_label) || match(r.destination_label));
  const shownGroups = groups.filter((g) => !q || match(g.name) || match(g.origin_label) || match(g.destination_label));

  const canInteract = !!user && v.verified;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <section className="border-b bg-[color:var(--asphalt)] text-white">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">Live board</p>
          <h1 className="mt-2 font-display text-3xl text-white md:text-5xl">Lift clubs & rides</h1>
          <p className="mt-3 max-w-xl text-sm text-white/70">
            Everything posted on LiftClub is listed here. Browsing is open to everyone — booking a seat or joining a club needs a verified account.
          </p>
          <div className="mt-6 flex max-w-md items-center gap-2 rounded-md bg-white/10 px-3 ring-1 ring-white/15">
            <Search className="h-4 w-4 text-white/60" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a suburb, town or route…"
              className="border-0 bg-transparent text-white placeholder:text-white/40 focus-visible:ring-0"
            />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {!canInteract && (
          <div className="mb-6 flex flex-col items-start gap-3 rounded-lg border border-[color:var(--signal)]/30 bg-[color:var(--sky-tint)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--signal)]" />
              <span>
                {!user
                  ? "You're browsing as a guest. Create an account to book seats, chat with drivers and see live tracking."
                  : "Your account isn't verified yet. Finish your KYC upload — an admin verifies it, then booking and posting unlock."}
              </span>
            </div>
            <Button asChild className="brand-gradient">
              <Link to={!user ? "/auth" : v.role === "driver" ? "/become-driver" : "/verify-identity"}>
                {!user ? "Create account" : "Complete verification"}
              </Link>
            </Button>
          </div>
        )}

        <div className="mb-5 inline-flex rounded-md border bg-card p-1">
          {(["rides", "clubs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-4 py-1.5 text-sm font-medium capitalize transition ${
                tab === t ? "bg-[color:var(--asphalt)] text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "rides" ? `Rides (${shownRides.length})` : `Lift clubs (${shownGroups.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the board…
          </div>
        ) : tab === "rides" ? (
          shownRides.length === 0 ? (
            <Empty text="No scheduled rides match that search yet." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shownRides.map((r) => {
                const d = new Date(r.depart_at);
                return (
                  <Card key={r.id} className="overflow-hidden">
                    <div className="flex items-stretch">
                      <div className="flex w-20 shrink-0 flex-col items-center justify-center bg-[color:var(--asphalt)] px-2 py-4 text-white">
                        <span className="text-[10px] uppercase tracking-widest text-white/50">
                          {d.toLocaleDateString("en-ZA", { weekday: "short" })}
                        </span>
                        <span className="font-mono-num text-2xl leading-tight">{d.getDate()}</span>
                        <span className="text-[10px] uppercase tracking-widest text-white/50">
                          {d.toLocaleDateString("en-ZA", { month: "short" })}
                        </span>
                      </div>
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{r.origin_label}</p>
                            <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                              <ArrowRight className="h-3 w-3" /> {r.destination_label}
                            </p>
                          </div>
                          <Badge variant={r.is_full || r.seats_left <= 0 ? "secondary" : "default"}>
                            {r.is_full || r.seats_left <= 0 ? "Full" : `${r.seats_left} seats`}
                          </Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="font-mono-num text-xs text-muted-foreground">
                            {d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })} · {r.vehicle_type}
                          </span>
                          <span className="font-mono-num text-lg text-[color:var(--signal)]">
                            R{Number(r.price_per_seat).toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-3">
                          {canInteract ? (
                            <Button asChild size="sm" variant="outline" className="w-full">
                              <Link to="/ride/$id" params={{ id: r.id }}>View & request seat</Link>
                            </Button>
                          ) : (
                            <Button asChild size="sm" variant="outline" className="w-full">
                              <Link to="/auth"><Lock className="mr-2 h-3 w-3" /> Verify to book</Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        ) : shownGroups.length === 0 ? (
          <Empty text="No public lift clubs match that search yet." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shownGroups.map((g) => (
              <Card key={g.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold">{g.name}</h3>
                  <Badge variant="secondary" className="capitalize">{g.vehicle_type}</Badge>
                </div>
                <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {g.origin_label}
                </p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <ArrowRight className="h-3 w-3" /> {g.destination_label}
                </p>
                {g.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{g.description}</p>}
                <div className="mt-4">
                  {canInteract ? (
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <Link to="/group/$id" params={{ id: g.id }}><Users className="mr-2 h-3 w-3" /> Open club</Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <Link to="/auth"><Lock className="mr-2 h-3 w-3" /> Verify to join</Link>
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">{text}</div>
  );
}
