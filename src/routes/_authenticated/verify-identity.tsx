import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Clock, XCircle, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/verify-identity")({
  component: VerifyIdentity,
});

type V = {
  id?: string;
  status?: "pending" | "approved" | "rejected";
  admin_notes?: string | null;
  id_number?: string | null;
  id_document_url?: string | null;
  selfie_url?: string | null;
};

function VerifyIdentity() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState<V>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("rider_verifications").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setV(data as V);
      setLoading(false);
    })();
  }, [user]);

  const readOnly = v.status === "approved" || v.status === "pending";

  async function upload(field: "id_document_url" | "selfie_url", file: File) {
    if (!user) return;
    const path = `${user.id}/${field}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("driver-docs").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    setV((s) => ({ ...s, [field]: path }));
    toast.success("Uploaded");
  }

  async function submit() {
    if (!user) return;
    if (!v.id_number || !v.id_document_url || !v.selfie_url) {
      return toast.error("Please add your ID number, ID document, and a selfie.");
    }
    setSaving(true);
    const payload = { user_id: user.id, status: "pending" as const, id_number: v.id_number, id_document_url: v.id_document_url, selfie_url: v.selfie_url };
    const { error } = v.id
      ? await supabase.from("rider_verifications").update(payload).eq("id", v.id)
      : await supabase.from("rider_verifications").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Submitted for admin review!");
    setV((s) => ({ ...s, status: "pending" }));
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8 animate-fade-in">
        <h1 className="text-3xl font-bold">Verify your identity</h1>
        <p className="text-muted-foreground">Upload your ID and a selfie so admins can verify you.</p>

        {v.status && (
          <Card className="mt-4 p-4">
            <div className="flex items-center gap-3">
              {v.status === "approved" && <Badge className="bg-emerald-600 text-white gap-1"><ShieldCheck className="h-3 w-3" />Approved</Badge>}
              {v.status === "pending" && <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Under review</Badge>}
              {v.status === "rejected" && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>}
              <span className="text-sm text-muted-foreground">
                {v.status === "approved" && "You're verified."}
                {v.status === "pending" && "Admin is reviewing your submission."}
                {v.status === "rejected" && "Please update and resubmit."}
              </span>
            </div>
            {v.admin_notes && <p className="mt-2 text-sm"><b>Admin notes:</b> {v.admin_notes}</p>}
          </Card>
        )}

        <Card className="mt-6 space-y-5 p-5">
          <div className="space-y-1.5">
            <Label>ID / Passport number</Label>
            <Input value={v.id_number ?? ""} disabled={readOnly} onChange={(e) => setV((s) => ({ ...s, id_number: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>ID document (photo or PDF)</Label>
            <Input type="file" accept="image/*,application/pdf" disabled={readOnly} onChange={(e) => e.target.files?.[0] && upload("id_document_url", e.target.files[0])} />
            {v.id_document_url && <p className="truncate text-xs text-muted-foreground">✓ {v.id_document_url.split("/").pop()}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Selfie holding your ID</Label>
            <Input type="file" accept="image/*" disabled={readOnly} onChange={(e) => e.target.files?.[0] && upload("selfie_url", e.target.files[0])} />
            {v.selfie_url && <p className="truncate text-xs text-muted-foreground">✓ {v.selfie_url.split("/").pop()}</p>}
          </div>

          {!readOnly && (
            <Button onClick={submit} disabled={saving} className="brand-gradient text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="mr-2 h-4 w-4" />Submit for review</>}
            </Button>
          )}
          {v.status === "rejected" && (
            <Button variant="outline" onClick={() => setV((s) => ({ ...s, status: undefined, id: undefined }))}>Edit & resubmit</Button>
          )}
        </Card>

        <div className="mt-6">
          <Button asChild variant="ghost"><Link to="/dashboard">← Back to dashboard</Link></Button>
        </div>
      </main>
    </div>
  );
}
