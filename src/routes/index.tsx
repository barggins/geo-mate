import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { RouteHero } from "@/components/RouteHero";
import {
  MapPin, Users, Shield, Zap, MessageCircle, Star, ArrowRight, Check, Radio,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LiftClub — Share the ride. Split the cost." },
      { name: "description", content: "LiftClub connects South African commuters heading the same way. Verified drivers, live tracking, fares that beat solo driving or a daily Uber." },
      { property: "og:title", content: "LiftClub — Share the ride. Split the cost." },
      { property: "og:description", content: "Verified commuter carpools with live tracking. Cheaper than solo driving. Cheaper than a daily Uber." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* HERO — dispatch strip */}
      <section className="border-b border-[color:var(--asphalt)]/10 animate-fade-in">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-10 md:grid-cols-[1.1fr_1.2fr] md:pt-16 lg:gap-14">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--asphalt)]/12 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-[color:var(--steel)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--transit)]" />
              Live · South Africa
            </div>
            <h1 className="font-display text-4xl leading-[1.02] tracking-tight text-[color:var(--asphalt)] md:text-6xl">
              Share the ride.<br />
              <span className="text-[color:var(--signal)]">Split the cost.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[color:var(--steel)]">
              LiftClub connects commuters heading the same way, every day. Verified drivers, live tracking,
              and fares that beat a daily Uber or a petrol tank — without the wait.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-md bg-[color:var(--signal)] px-6 font-semibold text-[color:var(--asphalt)] shadow-[0_6px_20px_-8px_rgba(255,176,32,0.6)] transition-transform hover:scale-[1.02] hover:bg-[color:var(--signal)]">
                <Link to="/auth">Get started free <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-md border-[color:var(--asphalt)]/15 bg-white px-6 font-semibold text-[color:var(--asphalt)] hover:bg-[color:var(--sky-tint)]">
                <Link to="/search">Find a ride near me</Link>
              </Button>
            </div>

            {/* Trust strip with mono numerals */}
            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-[color:var(--asphalt)]/10 pt-6">
              {[
                { k: "Avg saved / month", v: "R400–R900" },
                { k: "Verified drivers", v: "100%" },
                { k: "Live GPS", v: "On every trip" },
              ].map((s) => (
                <div key={s.k}>
                  <dd className="font-mono-num text-lg font-semibold text-[color:var(--asphalt)]">{s.v}</dd>
                  <dt className="mt-0.5 text-[11px] uppercase tracking-widest text-[color:var(--steel)]">{s.k}</dt>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <RouteHero />
          </div>
        </div>
      </section>

      {/* Feature grid — quiet, monochrome, mono labels */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono-num text-[11px] uppercase tracking-widest text-[color:var(--steel)]">/ 01 · What you get</p>
              <h2 className="mt-2 font-display text-3xl tracking-tight text-[color:var(--asphalt)] md:text-4xl">Everything a commuter needs.</h2>
            </div>
            <p className="max-w-md text-sm text-[color:var(--steel)]">A focused set of tools that just work. No fluff, no noise.</p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-xl border border-[color:var(--asphalt)]/10 bg-[color:var(--asphalt)]/10 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { i: MapPin, t: "Smart route matching", d: "Riders matched to routes within walking distance of pickup and dropoff." },
              { i: Zap, t: "Real-time tracking", d: "Live driver location, ETA and seat status update instantly via secure sockets." },
              { i: Shield, t: "Verified profiles", d: "ID, licence and vehicle checks before any driver picks up a passenger." },
              { i: Users, t: "Recurring commutes", d: "Set your daily run once. Riders book the days they need a lift." },
              { i: MessageCircle, t: "In-app chat", d: "Coordinate pickup safely — no phone numbers shared." },
              { i: Star, t: "Mutual reviews", d: "Ratings and notes after every ride keep the network trustworthy." },
            ].map((f, i) => (
              <div key={f.t} style={{ animationDelay: `${i * 60}ms` }} className="group bg-background p-6 transition-all duration-300 hover:bg-[color:var(--sky-tint)] hover:-translate-y-0.5 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[color:var(--asphalt)] text-[color:var(--signal)]">
                    <f.i className="h-5 w-5" />
                  </span>
                  <span className="font-mono-num text-[10px] uppercase tracking-widest text-[color:var(--steel)]">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-lg text-[color:var(--asphalt)]">{f.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--steel)]">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — dark dispatch band */}
      <section className="bg-[color:var(--asphalt)] py-20 text-[color:var(--concrete)]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12">
            <p className="font-mono-num text-[11px] uppercase tracking-widest text-[color:var(--signal)]">/ 02 · How it works</p>
            <h2 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">Two sides, one commute.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                tag: "FOR DRIVERS",
                title: "Post your route, fill empty seats.",
                steps: ["Set origin, destination & departure", "We draw your route — riders matched along the way", "Accept requests, drive, mark complete"],
              },
              {
                tag: "FOR RIDERS",
                title: "Hop in a ride going your way.",
                steps: ["Tell us where you're going and when", "See drivers whose route passes near you", "Request a seat, track live, ride"],
              },
            ].map((col) => (
              <div key={col.tag} className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <p className="font-mono-num text-[11px] tracking-widest text-[color:var(--signal)]">{col.tag}</p>
                <h3 className="mt-2 font-display text-xl text-white">{col.title}</h3>
                <ol className="mt-5 space-y-3">
                  {col.steps.map((s, i) => (
                    <li key={s} className="flex items-start gap-3 text-sm text-white/80">
                      <span className="font-mono-num mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/15 text-[11px] text-[color:var(--signal)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING removed — product is still in development */}


      {/* CTA */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="relative overflow-hidden rounded-2xl bg-[color:var(--asphalt)] p-10 text-center text-white md:p-14">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[color:var(--signal)]" />
            <Radio className="mx-auto h-6 w-6 text-[color:var(--signal)]" />
            <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">Ready to share the ride?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/70">
              Join commuters cutting their cost, traffic, and carbon footprint every morning.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-md bg-[color:var(--signal)] px-6 font-semibold text-[color:var(--asphalt)] hover:bg-[color:var(--signal)]">
                <Link to="/auth">Create your account</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-md border-white/25 bg-transparent px-6 font-semibold text-white hover:bg-white/10">
                <Link to="/search">Browse rides</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[color:var(--asphalt)]/10 py-10 text-sm text-[color:var(--steel)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <Logo />
          <p className="font-mono-num text-[11px] uppercase tracking-widest">© {new Date().getFullYear()} LiftClub · Share the Ride. Split the Cost.</p>
        </div>
      </footer>
    </div>
  );
}
