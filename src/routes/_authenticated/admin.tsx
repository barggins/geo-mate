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
  const [apps, setApps] = useState<any[]>([]);
  const [q, setQ] = useState("");

  const loadApps = async () => {
    const { data } = await supabase
      .from("driver_applications")
      .select("*")
      .order("created_at", { ascending: false });
    setApps(data ?? []);
  };

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
        const list = rows ?? [];
        const ids = list.map((p: any) => p.id);
        if (ids.length) {
          const { data: priv } = await supabase.from("profile_private").select("user_id, phone").in("user_id", ids);
          const map = new Map((priv ?? []).map((p: any) => [p.user_id, p.phone]));
          list.forEach((p: any) => { p.phone = map.get(p.id) ?? null; });
        }
        setProfiles(list);
        await loadApps();
      }

    })();
  }, [user]);

  async function decideApp(id: string, status: "approved" | "rejected", notes?: string) {
    const { error } = await supabase
      .from("driver_applications")
      .update({ status, admin_notes: notes ?? null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Application ${status}`);
    await loadApps();
  }


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
    !q ? true : [p.name, p.employer, p.phone].some((v) => String(v ?? "").toLowerCase().includes(q.toLowerCase())),
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
                <p className="text-xs text-muted-foreground">{p.phone ?? "no phone"} · {p.employer ?? "no employer"}</p>
                {p.bio && <p className="mt-1 text-sm text-muted-foreground">{p.bio}</p>}
              </div>
              <Button variant={p.verified ? "outline" : "default"} className={p.verified ? "" : "brand-gradient text-white"} onClick={() => toggleVerified(p)}>
                {p.verified ? <><ShieldOff className="mr-2 h-4 w-4" />Revoke</> : <><ShieldCheck className="mr-2 h-4 w-4" />Verify</>}
              </Button>
            </div>
          ))}
        </Card>

        <h2 className="mt-10 mb-3 text-2xl font-bold">Driver applications</h2>
        <Card className="divide-y">
          {apps.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No applications submitted yet.</p>
          ) : apps.map((a) => (
            <div key={a.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">User: <span className="font-mono text-xs">{a.user_id}</span></p>
                  <p className="text-xs text-muted-foreground">Submitted {new Date(a.created_at).toLocaleString()}</p>
                </div>
                <Badge variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}
                  className={a.status === "approved" ? "bg-[color:var(--brand-green)] text-white" : ""}>
                  {a.status}
                </Badge>
              </div>
              <div className="grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                <div>Vehicle: {a.vehicle_make} {a.vehicle_model} ({a.vehicle_year}) — {a.vehicle_color}, {a.vehicle_plate}</div>
                <div>Bank: {a.bank_name} / {a.bank_account_holder} / {a.bank_account_number} / {a.bank_branch_code}</div>
                <div>Licence: {a.licence_url ? <span className="font-mono">{a.licence_url}</span> : "—"}</div>
                <div>Vehicle reg: {a.vehicle_reg_url ? <span className="font-mono">{a.vehicle_reg_url}</span> : "—"}</div>
                <div className="md:col-span-2">Vehicle photos: {(a.vehicle_photos ?? []).length} file(s)</div>
              </div>
              {a.admin_notes && <p className="text-xs"><b>Notes:</b> {a.admin_notes}</p>}
              {a.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" className="brand-gradient text-white" onClick={() => decideApp(a.id, "approved")}>
                    Approve & verify
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => {
                    const notes = window.prompt("Rejection reason (optional):") ?? undefined;
                    decideApp(a.id, "rejected", notes);
                  }}>
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      </main>
    </div>
  );
}
