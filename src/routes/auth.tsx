import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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
          <GoogleButton />
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
        if (error) toast.error(error.message); else toast.success("Welcome back!");
      }}
    >
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
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name }, emailRedirectTo: window.location.origin + "/dashboard" },
        });
        setBusy(false);
        if (error) toast.error(error.message);
        else toast.success("Account created — check your email if confirmation is required.");
      }}
    >
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
      <Button type="submit" className="w-full brand-gradient text-white" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Lock className="mr-2 h-4 w-4" /> Create account</>}
      </Button>
    </form>
  );
}

function GoogleButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
        if (result.error) { toast.error(String(result.error.message ?? result.error)); setBusy(false); }
      }}
    >
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.62 6.62 0 0 1 5.5 12c0-.73.12-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
      Continue with Google
    </Button>
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
