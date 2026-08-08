import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your password · LiftClub" },
      { name: "description", content: "Choose a new password for your LiftClub account." },
      { property: "og:title", content: "Reset your password · LiftClub" },
      { property: "og:description", content: "Choose a new password for your LiftClub account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--sky-tint)] px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex justify-center"><Logo /></Link>
        <Card className="space-y-4 p-6 shadow-lg">
          <h1 className="text-lg font-semibold">Set a new password</h1>
          {!ready ? (
            <p className="text-sm text-muted-foreground">
              Open this page from the reset link in your email. If the link expired, request a new one from the{" "}
              <Link to="/auth" className="underline">sign-in page</Link>.
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const { error } = await supabase.auth.updateUser({ password });
                setBusy(false);
                if (error) toast.error(error.message, { duration: 8000 });
                else {
                  toast.success("Password updated — you're signed in.");
                  navigate({ to: "/dashboard" });
                }
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="np">New password</Label>
                <Input id="np" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full brand-gradient" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="mr-2 h-4 w-4" /> Update password</>}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
