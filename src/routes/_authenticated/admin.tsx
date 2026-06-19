import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(!!data);
      if (data) {
        const { data: rows } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        setProfiles(rows ?? []);
      }
    })();
  }, [user]);

  if (isAdmin === null) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Admins only</h1>
          <p className="mt-2 text-muted-foreground">You don't have access to this page.</p>
        </main>
      </div>
    );
  }

  const filtered = profiles.filter((p) =>
    !q ? true : [p.name, p.email, p.employer, p.phone].some((v) => String(v ?? "").toLowerCase().includes(q.toLowerCase())),
  );

  async function toggleVerified(p: any) {
    const { error } = await supabase.from("profiles").update({ verified: !p.verified }).eq("id", p.id);
    if (error) return toast.error(error.message);
    setProfiles((cur) => cur.map((x) => (x.id === p.id ? { ...x, verified: !p.verified } : x)));
    toast.success(p.verified ? "Verification removed" : "User verified");
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Admin · User verification</h1>
            <p className="text-muted-foreground">Review profiles and grant the Verified badge.</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search name, email, employer…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Card className="divide-y">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No users.</p>
          ) : filtered.map((p) => (
            <div key={p.id} className="flex items-start gap-4 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full brand-gradient text-white font-bold">
                {(p.name ?? "?")[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{p.name ?? "Unnamed"}</p>
                  {p.verified ? <Badge className="bg-[color:var(--brand-green)] text-white">Verified</Badge> : <Badge variant="secondary">Unverified</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{p.email} · {p.phone ?? "no phone"} · {p.employer ?? "no employer"}</p>
                {p.bio && <p className="mt-1 text-sm text-muted-foreground">{p.bio}</p>}
              </div>
              <Button variant={p.verified ? "outline" : "default"} className={p.verified ? "" : "brand-gradient text-white"} onClick={() => toggleVerified(p)}>
                {p.verified ? <><ShieldOff className="mr-2 h-4 w-4" />Revoke</> : <><ShieldCheck className="mr-2 h-4 w-4" />Verify</>}
              </Button>
            </div>
          ))}
        </Card>
      </main>
    </div>
  );
}
