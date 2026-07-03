import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Upload, ShieldCheck, Clock, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/become-driver")({
  component: BecomeDriver,
});

type App = {
  id?: string;
  status?: "pending" | "approved" | "rejected";
  admin_notes?: string | null;
  licence_url?: string | null;
  vehicle_reg_url?: string | null;
  vehicle_photos?: string[];
  vehicle_make?: string; vehicle_model?: string; vehicle_year?: number | null;
  vehicle_color?: string; vehicle_plate?: string;
  bank_name?: string; bank_account_holder?: string; bank_account_number?: string; bank_branch_code?: string;
};

function BecomeDriver() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [app, setApp] = useState<App>({ vehicle_photos: [] });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("driver_applications").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setApp(data as App);
      setLoading(false);
    })();
  }, [user]);

  const readOnly = app.status === "approved" || app.status === "pending";

  async function uploadTo(field: "licence_url" | "vehicle_reg_url", file: File) {
    if (!user) return;
    const path = `${user.id}/${field}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("driver-docs").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    setApp((a) => ({ ...a, [field]: path }));
    toast.success("Uploaded");
  }

  async function uploadVehiclePhotos(files: FileList) {
    if (!user) return;
    const uploads: string[] = [];
    for (const file of Array.from(files).slice(0, 6)) {
      const path = `${user.id}/vehicle-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("driver-docs").upload(path, file);
      if (error) { toast.error(error.message); continue; }
      uploads.push(path);
    }
    setApp((a) => ({ ...a, vehicle_photos: [...(a.vehicle_photos ?? []), ...uploads] }));
  }

  async function submit() {
    if (!user) return;
    const required: (keyof App)[] = [
      "licence_url","vehicle_reg_url","vehicle_make","vehicle_model","vehicle_year",
      "vehicle_color","vehicle_plate","bank_name","bank_account_holder","bank_account_number","bank_branch_code",
    ];
    const missing = required.filter((k) => !app[k]);
    if (missing.length) return toast.error("Please complete all fields and uploads.");
    if (!(app.vehicle_photos ?? []).length) return toast.error("Add at least one vehicle photo.");

    setSaving(true);
    const payload = { ...app, user_id: user.id, status: "pending" as const };
    delete (payload as any).id;
    const { error } = app.id
      ? await supabase.from("driver_applications").update(payload).eq("id", app.id)
      : await supabase.from("driver_applications").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Application submitted for admin review!");
    setApp((a) => ({ ...a, status: "pending" }));
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold">Become a verified driver</h1>
        <p className="text-muted-foreground">Upload your documents so admins can approve you to post rides.</p>

        {app.status && (
          <Card className="mt-4 p-4">
            <div className="flex items-center gap-3">
              {app.status === "approved" && <Badge className="bg-[color:var(--brand-green)] text-white gap-1"><ShieldCheck className="h-3 w-3" />Approved</Badge>}
              {app.status === "pending" && <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Under review</Badge>}
              {app.status === "rejected" && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>}
              <span className="text-sm text-muted-foreground">
                {app.status === "approved" && "You can post rides."}
                {app.status === "pending" && "Admin is reviewing your application."}
                {app.status === "rejected" && "Please update your info and resubmit."}
              </span>
            </div>
            {app.admin_notes && <p className="mt-2 text-sm"><b>Admin notes:</b> {app.admin_notes}</p>}
            {app.status === "approved" && (
              <Button asChild className="mt-3 brand-gradient text-white"><Link to="/post-ride">Post your first ride</Link></Button>
            )}
          </Card>
        )}

        <Card className="mt-6 space-y-6 p-5">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Documents</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <FileField label="Driver's licence" value={app.licence_url} disabled={readOnly}
                onChange={(f) => uploadTo("licence_url", f)} />
              <FileField label="Vehicle registration" value={app.vehicle_reg_url} disabled={readOnly}
                onChange={(f) => uploadTo("vehicle_reg_url", f)} />
            </div>
            <div className="mt-4">
              <Label>Vehicle photos (up to 6)</Label>
              <Input type="file" multiple accept="image/*" disabled={readOnly}
                onChange={(e) => e.target.files && uploadVehiclePhotos(e.target.files)} />
              <p className="mt-1 text-xs text-muted-foreground">{(app.vehicle_photos ?? []).length} uploaded</p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Vehicle details</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField label="Make" v={app.vehicle_make} on={(v) => setApp((a) => ({ ...a, vehicle_make: v }))} readOnly={readOnly} />
              <TextField label="Model" v={app.vehicle_model} on={(v) => setApp((a) => ({ ...a, vehicle_model: v }))} readOnly={readOnly} />
              <TextField label="Year" type="number" v={app.vehicle_year?.toString()} on={(v) => setApp((a) => ({ ...a, vehicle_year: v ? parseInt(v) : null }))} readOnly={readOnly} />
              <TextField label="Colour" v={app.vehicle_color} on={(v) => setApp((a) => ({ ...a, vehicle_color: v }))} readOnly={readOnly} />
              <TextField label="Plate number" v={app.vehicle_plate} on={(v) => setApp((a) => ({ ...a, vehicle_plate: v }))} readOnly={readOnly} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Banking details <span className="text-xs text-muted-foreground">(so we can pay you out)</span></h2>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField label="Bank" v={app.bank_name} on={(v) => setApp((a) => ({ ...a, bank_name: v }))} readOnly={readOnly} />
              <TextField label="Account holder" v={app.bank_account_holder} on={(v) => setApp((a) => ({ ...a, bank_account_holder: v }))} readOnly={readOnly} />
              <TextField label="Account number" v={app.bank_account_number} on={(v) => setApp((a) => ({ ...a, bank_account_number: v }))} readOnly={readOnly} />
              <TextField label="Branch code" v={app.bank_branch_code} on={(v) => setApp((a) => ({ ...a, bank_branch_code: v }))} readOnly={readOnly} />
            </div>
          </section>

          {!readOnly && (
            <Button onClick={submit} disabled={saving} className="brand-gradient text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="mr-2 h-4 w-4" />Submit for review</>}
            </Button>
          )}
          {app.status === "rejected" && (
            <Button variant="outline" onClick={() => setApp((a) => ({ ...a, status: undefined }))}>Edit & resubmit</Button>
          )}
        </Card>
      </main>
    </div>
  );
}

function TextField({ label, v, on, type = "text", readOnly }: { label: string; v?: string | null; on: (v: string) => void; type?: string; readOnly?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={v ?? ""} onChange={(e) => on(e.target.value)} disabled={readOnly} />
    </div>
  );
}

function FileField({ label, value, onChange, disabled }: { label: string; value?: string | null; onChange: (f: File) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="file" accept="image/*,application/pdf" disabled={disabled}
        onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
      {value && <p className="truncate text-xs text-muted-foreground">✓ Uploaded: {value.split("/").pop()}</p>}
    </div>
  );
}
