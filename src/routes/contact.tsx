import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact us · LiftClub" },
      { name: "description", content: "Get in touch with the LiftClub team — support, partnerships, and press enquiries." },
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-16 animate-fade-in">
        <p className="font-mono-num text-[11px] uppercase tracking-widest text-[color:var(--steel)]">/ Support</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-[color:var(--asphalt)]">Contact us</h1>
        <p className="mt-3 max-w-xl text-[color:var(--steel)]">
          Questions, feedback, or partnership ideas? We'd love to hear from you.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card className="p-5"><Mail className="mb-2 h-5 w-5 text-[color:var(--signal,#FFB020)]" /><p className="text-xs uppercase tracking-widest text-muted-foreground">Email</p><a href="mailto:hello@liftclub.co.za" className="text-sm font-medium">hello@liftclub.co.za</a></Card>
          <Card className="p-5"><Phone className="mb-2 h-5 w-5 text-[color:var(--signal,#FFB020)]" /><p className="text-xs uppercase tracking-widest text-muted-foreground">Phone</p><a href="tel:+27000000000" className="text-sm font-medium">+27 (0)00 000 0000</a></Card>
          <Card className="p-5"><MapPin className="mb-2 h-5 w-5 text-[color:var(--signal,#FFB020)]" /><p className="text-xs uppercase tracking-widest text-muted-foreground">Based in</p><p className="text-sm font-medium">South Africa</p></Card>
        </div>

        <div className="mt-10">
          <Button asChild><Link to="/">← Back home</Link></Button>
        </div>
      </main>
    </div>
  );
}
