import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service · LiftClub" },
      { name: "description", content: "The rules for using LiftClub — verified commuter carpooling in South Africa." },
      { property: "og:title", content: "Terms of Service · LiftClub" },
      { property: "og:description", content: "The rules for using LiftClub — verified commuter carpooling in South Africa." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12 prose prose-slate">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: 17 July 2026</p>

        <h2 className="mt-8 text-xl font-semibold">1. What LiftClub is</h2>
        <p>LiftClub is a platform that connects South African commuters who want to share rides. LiftClub is <b>not</b> a transport operator — drivers on the platform are private individuals, not employees, and cost-sharing is between rider and driver.</p>

        <h2 className="mt-6 text-xl font-semibold">2. Eligibility</h2>
        <ul className="list-disc pl-6">
          <li>You must be 18 or older.</li>
          <li>You must submit truthful identity information. Drivers must submit a valid driver's licence, vehicle registration, and vehicle photos for review.</li>
          <li>We reserve the right to reject or revoke verification at any time.</li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">3. Acceptable use</h2>
        <p>You agree not to harass, discriminate against, or endanger other users; not to use LiftClub for illegal activity; and not to impersonate anyone else. Violations lead to account termination.</p>

        <h2 className="mt-6 text-xl font-semibold">4. Payments (coming soon)</h2>
        <p>Payments inside LiftClub are not yet enabled. When enabled, cost-sharing amounts are set by the driver and paid by the rider. LiftClub facilitates the transaction but is not a party to the ride agreement itself.</p>

        <h2 className="mt-6 text-xl font-semibold">5. Safety, SOS and location sharing</h2>
        <p>When you accept or drive a ride, your live location is shared with the other party for the duration of the trip. The SOS button contacts South African emergency services (10111). LiftClub does not replace emergency services.</p>

        <h2 className="mt-6 text-xl font-semibold">6. Liability</h2>
        <p>LiftClub is provided "as is." To the extent permitted by South African law, LiftClub is not liable for any loss, injury, or damage arising from a ride arranged through the platform. Drivers are responsible for maintaining valid licences, roadworthy vehicles, and appropriate insurance.</p>

        <h2 className="mt-6 text-xl font-semibold">7. Account termination</h2>
        <p>You may delete your account at any time from Settings. We may suspend or delete accounts that violate these terms or applicable law.</p>

        <h2 className="mt-6 text-xl font-semibold">8. Changes</h2>
        <p>We may update these terms. Material changes will be notified in-app.</p>

        <h2 className="mt-6 text-xl font-semibold">9. Contact</h2>
        <p>Questions? <Link to="/contact" className="underline">Contact us</Link>.</p>
      </main>
      <Footer />
    </div>
  );
}
