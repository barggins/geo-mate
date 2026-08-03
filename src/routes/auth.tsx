import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2, Mail, Phone, Lock } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · LiftClub" },
      { name: "description", content: "Sign in or create your LiftClub commuter account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--sky-tint)] px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex justify-center"><Logo /></Link>
        <Card className="p-6 shadow-lg">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-6">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup" className="mt-6">
              <SignUpForm />
            </TabsContent>
          </Tabs>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>
          <PhoneSection />


        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to LiftClub's terms and privacy policy.
        </p>
      </div>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (error) {
          const msg = /invalid login/i.test(error.message)
            ? "Wrong email or password. Check both and try again."
            : error.message;
          toast.error(msg, { duration: 8000 });
        } else toast.success("Welcome back!");
      }}
    >
      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
        You can sign in immediately after registering. Your account is then <strong>verified by a LiftClub admin</strong> after you submit your KYC documents.
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="si-email">Email</Label>
        <Input id="si-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="si-pw">Password</Label>
        <Input id="si-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full brand-gradient text-white" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="mr-2 h-4 w-4" /> Sign in</>}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"rider" | "driver">("rider");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!agreed) { toast.error("You must accept the Terms and Privacy Policy to create an account."); return; }
        setBusy(true);
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name, role }, emailRedirectTo: window.location.origin + "/dashboard" },
        });
        setBusy(false);
        if (error) toast.error(error.message, { duration: 8000 });
        else toast.success("Account created — you're signed in. Submit your KYC documents so an admin can verify you.", { duration: 8000 });
      }}
    >
      <div className="space-y-1.5">
        <Label>I am a…</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["rider","driver"] as const).map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-md border px-3 py-3 text-sm font-medium capitalize transition ${
                role === r
                  ? "border-[color:var(--signal,#FFB020)] bg-amber-50 text-amber-900"
                  : "border-border bg-background hover:bg-accent/50"
              }`}
            >
              {r === "rider" ? "🧍 Rider" : "🚗 Driver"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {role === "driver"
            ? "You'll be asked to upload your driver's licence, vehicle papers and banking details for admin approval."
            : "You'll be asked to upload your ID document and a selfie for admin approval."}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-name">Name</Label>
        <Input id="su-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-pw">Password</Label>
        <Input id="su-pw" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <label className="flex items-start gap-2 rounded-md border p-2 text-xs">
        <input type="checkbox" className="mt-0.5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          I am 18 or older and I agree to the{" "}
          <Link to="/terms" className="underline">Terms of Service</Link> and{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link>, including sharing my live location with the other party during accepted rides.
        </span>
      </label>
      <Button type="submit" className="w-full brand-gradient text-white" disabled={busy || !agreed}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Lock className="mr-2 h-4 w-4" /> Create account</>}
      </Button>
    </form>
  );
}


function PhoneSection() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 space-y-2">
      <Label className="text-xs text-muted-foreground">Or use phone (SMS provider required)</Label>
      <div className="flex gap-2">
        <Input
          placeholder="+44 7… "
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || !phone}
          onClick={async () => {
            setBusy(true);
            const { error } = await supabase.auth.signInWithOtp({ phone });
            setBusy(false);
            if (error) toast.error(error.message); else { setSent(true); toast.success("Code sent"); }
          }}
        >
          <Phone className="h-4 w-4" />
        </Button>
      </div>
      {sent && (
        <div className="flex gap-2">
          <Input placeholder="6-digit code" value={otp} onChange={(e) => setOtp(e.target.value)} />
          <Button
            type="button"
            disabled={busy || otp.length < 4}
            onClick={async () => {
              setBusy(true);
              const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
              setBusy(false);
              if (error) toast.error(error.message);
            }}
          >
            Verify
          </Button>
        </div>
      )}
    </div>
  );
}
