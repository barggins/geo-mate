import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import {
  MapPin, Users, Clock, Shield, Zap, MessageCircle, Star, ArrowRight, Check,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LiftClub — Commuter carpools that go your way" },
      { name: "description", content: "Share the ride to work with verified commuters. Post a route or hop in one heading near you. Live tracking, in-app chat, and fair pricing." },
      { property: "og:title", content: "LiftClub — Commuter carpools that go your way" },
      { property: "og:description", content: "Share the ride to work with verified commuters. Live tracking included." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--sky-tint),_transparent_60%)]" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-12 md:grid-cols-2 md:pt-20 lg:gap-16">
          <div className="flex flex-col justify-center">
            <Badge variant="secondary" className="mb-4 w-fit gap-1.5 bg-accent text-accent-foreground">
              <Zap className="h-3 w-3" /> Built for daily commuters
            </Badge>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Share the ride.{" "}
              <span className="brand-gradient-text">Save together.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              LiftClub matches working people heading in the same direction. Post your commute or jump in
              one going your way — with live tracking, verified profiles, and friendly pricing.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="brand-gradient h-12 px-6 text-white hover:opacity-95">
                <Link to="/auth">Get started free <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6">
                <Link to="/search">Find a ride near me</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5"><Check className="h-4 w-4 text-[color:var(--brand-green)]" /> Verified commuters</div>
              <div className="flex items-center gap-1.5"><Check className="h-4 w-4 text-[color:var(--brand-green)]" /> Live GPS tracking</div>
              <div className="flex items-center gap-1.5"><Check className="h-4 w-4 text-[color:var(--brand-green)]" /> Smart route matching</div>
            </div>
          </div>

          {/* Hero card mock */}
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl brand-gradient opacity-10 blur-2xl" />
            <Card className="overflow-hidden border-2 p-0 shadow-xl">
              <div className="brand-gradient p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider opacity-80">Live ride · 8:42 AM</p>
                    <h3 className="mt-1 text-2xl font-bold">Reading → London Bridge</h3>
                  </div>
                  <Badge className="bg-white/20 text-white">2 seats left</Badge>
                </div>
                <div className="mt-4 flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> 1h 12m</div>
                  <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> 4.2 km detour</div>
                  <div className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-current" /> 4.9</div>
                </div>
              </div>
              <div className="space-y-4 p-6">
                {[
                  { name: "Aisha · Driver", emp: "Acme Corp", role: "Driver" },
                  { name: "Tom · Rider", emp: "Acme Corp", role: "Joining" },
                  { name: "Priya · Rider", emp: "Studio Ltd", role: "Joining" },
                ].map((p) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-bold">
                      {p.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.emp}</p>
                    </div>
                    <Badge variant="outline">{p.role}</Badge>
                  </div>
                ))}
                <Button className="w-full brand-gradient text-white">Request a seat</Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="border-t bg-[color:var(--sky-tint)]/50 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Everything a commuter needs</h2>
            <p className="mt-3 text-muted-foreground">A focused set of tools that just work — no fluff.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { i: MapPin, t: "Smart route matching", d: "We match riders to routes that pass within walking distance of pickup and dropoff." },
              { i: Zap, t: "Real-time tracking", d: "Live driver location, ETA, and seat status update instantly via secure WebSockets." },
              { i: Shield, t: "Verified profiles", d: "Phone & employer-domain verification builds a trustworthy commuter network." },
              { i: Users, t: "Recurring commutes", d: "Set your daily run once. Riders book the days they need a lift." },
              { i: MessageCircle, t: "In-app chat", d: "Coordinate pickup details safely without sharing phone numbers." },
              { i: Star, t: "Mutual reviews", d: "Star ratings and notes after every ride keep the community safe and friendly." },
            ].map((f) => (
              <Card key={f.t} className="p-6 transition-shadow hover:shadow-md">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg brand-gradient text-white">
                  <f.i className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.d}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">How it works</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Card className="p-6">
              <Badge className="brand-gradient text-white">For drivers</Badge>
              <h3 className="mt-3 text-xl font-bold">Post your route, fill empty seats</h3>
              <ol className="mt-4 space-y-3 text-sm">
                {["Set origin, destination & departure time", "We draw your route — riders are matched along the way", "Accept requests, drive, mark complete"].map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-blue)] text-xs font-bold text-white">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </Card>
            <Card className="p-6">
              <Badge className="bg-[color:var(--brand-green)] text-white">For riders</Badge>
              <h3 className="mt-3 text-xl font-bold">Hop in a ride going your way</h3>
              <ol className="mt-4 space-y-3 text-sm">
                {["Tell us where you're going and when", "See drivers whose route passes near you", "Request a seat, track them live, ride"].map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-green)] text-xs font-bold text-white">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t bg-[color:var(--sky-tint)]/50 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Pricing</h2>
            <p className="mt-3 text-muted-foreground">Start free. Upgrade when you commute every day.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { tag: "Free", name: "Basic", price: "£0", features: ["Post up to 2 rides/month", "Request up to 5 rides/month", "Basic profile", "In-app messaging"] },
              { tag: "Most popular", name: "Commuter Pro", price: "£4.99", popular: true, features: ["Unlimited ride posts", "Unlimited ride requests", "Priority matching", "Recurring/daily rides", "Verified badge", "Advanced filters"] },
              { tag: "Business", name: "Team", price: "£12", features: ["Everything in Pro", "Company domain matching", "Admin dashboard", "Bulk seat bookings", "SSO login", "HR reporting exports"] },
            ].map((p) => (
              <Card key={p.name} className={`relative p-6 ${p.popular ? "border-2 border-[color:var(--brand-blue)] shadow-lg" : ""}`}>
                <Badge variant={p.popular ? "default" : "secondary"} className={p.popular ? "brand-gradient text-white" : ""}>
                  {p.tag}
                </Badge>
                <h3 className="mt-3 text-xl font-bold">{p.name}</h3>
                <p className="mt-1"><span className="text-3xl font-extrabold">{p.price}</span><span className="text-sm text-muted-foreground"> / mo</span></p>
                <ul className="mt-5 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-green)]" />{f}</li>
                  ))}
                </ul>
                <Button asChild className={`mt-6 w-full ${p.popular ? "brand-gradient text-white" : ""}`} variant={p.popular ? "default" : "outline"}>
                  <Link to="/auth">{p.popular ? "Start Pro" : "Choose " + p.name}</Link>
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <div className="rounded-2xl brand-gradient p-10 text-white shadow-xl md:p-14">
            <h2 className="text-3xl font-bold md:text-4xl">Ready to share the ride?</h2>
            <p className="mx-auto mt-3 max-w-xl opacity-90">Join thousands of commuters cutting their cost, traffic, and carbon footprint.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="secondary" className="h-12 px-6">
                <Link to="/auth">Create your account</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-white/40 bg-white/10 px-6 text-white hover:bg-white/20">
                <Link to="/search">Browse rides</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-10 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} LiftClub. Share the Ride. Save Together.</p>
        </div>
      </footer>
    </div>
  );
}
