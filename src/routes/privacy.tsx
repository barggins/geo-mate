import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · LiftClub" },
      { name: "description", content: "How LiftClub handles your identity documents, location data, and account information." },
      { property: "og:title", content: "Privacy Policy · LiftClub" },
      { property: "og:description", content: "How LiftClub handles your identity documents, location data, and account information." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12 prose prose-slate">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: 17 July 2026</p>

        <p className="mt-4">This policy explains what we collect, why we collect it, and who can see it. It applies to your use of LiftClub in South Africa and is written to align with the Protection of Personal Information Act (POPIA).</p>

        <h2 className="mt-8 text-xl font-semibold">1. Information we collect</h2>
        <ul className="list-disc pl-6">
          <li><b>Account:</b> name, email, phone, password (hashed by our auth provider).</li>
          <li><b>Identity documents:</b> ID number, ID photo/scan, and a selfie holding your ID (riders and drivers).</li>
          <li><b>Driver KYC:</b> driver's licence, vehicle registration document, vehicle photos, plate number, banking details (for future payouts).</li>
          <li><b>Location:</b> approximate location for search; precise live location only during an active accepted ride, and briefly when you tap "Use my location."</li>
          <li><b>Ride data:</b> routes posted/requested, messages between rider and driver, reviews.</li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">2. Who can see what</h2>
        <ul className="list-disc pl-6">
          <li><b>ID documents & driver KYC:</b> only you and platform administrators. Never other users.</li>
          <li><b>Live location during a ride:</b> only the other participant of the same accepted ride.</li>
          <li><b>Profile name, photo, verified badge, reviews:</b> visible to signed-in users.</li>
          <li><b>Contact details (phone, home address):</b> stored in a private table and never exposed on public profile pages.</li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">3. How long we keep it</h2>
        <ul className="list-disc pl-6">
          <li>KYC documents: kept while your account is active + 12 months after last use, for fraud investigation.</li>
          <li>Ride logs and messages: kept for 3 years for safety and dispute resolution.</li>
          <li>Live location pings: rolling window, oldest deleted after 30 days.</li>
          <li>When you delete your account, personal data is removed within 30 days except where retention is legally required.</li>
        </ul>

        <h2 className="mt-6 text-xl font-semibold">4. Sharing with third parties</h2>
        <p>We share data with: our authentication and database provider (Supabase); map/routing providers (OpenStreetMap tiles, OSRM routing); email delivery when enabled. We do not sell your personal data.</p>

        <h2 className="mt-6 text-xl font-semibold">5. Your rights (POPIA)</h2>
        <p>You may request access to, correction of, or deletion of your personal information. Use <Link to="/contact" className="underline">Contact us</Link> or Settings → Delete account.</p>

        <h2 className="mt-6 text-xl font-semibold">6. Security</h2>
        <p>Passwords are hashed. KYC uploads live in a private storage bucket accessible only to the uploader and admins via short-lived signed URLs. Database access is enforced with row-level security.</p>

        <h2 className="mt-6 text-xl font-semibold">7. Children</h2>
        <p>LiftClub is not for anyone under 18.</p>

        <h2 className="mt-6 text-xl font-semibold">8. Changes</h2>
        <p>Material changes will be notified in-app before they take effect.</p>
      </main>
      <Footer />
    </div>
  );
}
