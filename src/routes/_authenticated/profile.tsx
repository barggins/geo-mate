import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [priv, setPriv] = useState<any>({ phone: "", home_address: "", work_address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: pp }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("profile_private").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      setProfile(prof ?? {});
      if (pp) setPriv({ phone: pp.phone ?? "", home_address: pp.home_address ?? "", work_address: pp.work_address ?? "" });
    })();
  }, [user]);

  if (!profile) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold">Your profile</h1>
        <Card className="mt-6 space-y-4 p-6">
          <Field label="Name"><Input value={profile.name ?? ""} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
          <Field label="Phone"><Input value={priv.phone} onChange={(e) => setPriv({ ...priv, phone: e.target.value })} /></Field>
          <Field label="Employer / Company"><Input value={profile.employer ?? ""} onChange={(e) => setProfile({ ...profile, employer: e.target.value })} placeholder="Helps match commuters from your workplace" /></Field>
          <Field label="Home address"><Input value={priv.home_address} onChange={(e) => setPriv({ ...priv, home_address: e.target.value })} /></Field>
          <Field label="Work address"><Input value={priv.work_address} onChange={(e) => setPriv({ ...priv, work_address: e.target.value })} /></Field>
          <Field label="Bio"><Textarea value={profile.bio ?? ""} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Tell other commuters a little about you" /></Field>
          <Field label="Photo URL"><Input value={profile.photo_url ?? ""} onChange={(e) => setProfile({ ...profile, photo_url: e.target.value })} /></Field>
          <Button
            disabled={saving}
            className="brand-gradient text-white"
            onClick={async () => {
              setSaving(true);
              const { error: e1 } = await supabase.from("profiles").update({
                name: profile.name, employer: profile.employer,
                bio: profile.bio, photo_url: profile.photo_url,
              }).eq("id", user!.id);
              const { error: e2 } = await supabase.from("profile_private").upsert({
                user_id: user!.id,
                phone: priv.phone || null,
                home_address: priv.home_address || null,
                work_address: priv.work_address || null,
              });
              setSaving(false);
              const err = e1 || e2;
              if (err) toast.error(err.message); else toast.success("Saved");
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </Card>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
