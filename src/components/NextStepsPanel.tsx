import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Clock, XCircle, CheckCircle2, Upload } from "lucide-react";
import type { VerificationInfo } from "@/lib/useVerification";

/**
 * Role-aware "what to do next" panel. Riders and drivers see only the steps
 * that apply to them, with the exact blocker spelled out.
 */
export function NextStepsPanel({ v, dark }: { v: VerificationInfo; dark?: boolean }) {
  if (v.loading) return null;

  const muted = dark ? "text-slate-400" : "text-slate-500";
  const surface = dark ? "bg-[#141C27] text-slate-100 border-white/10" : "bg-white text-slate-900 border-slate-200";

  const steps = v.role === "driver" ? driverSteps(v) : riderSteps(v);
  const outstanding = steps.filter((s) => s.state !== "done");

  return (
    <Card className={`p-5 ${surface}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-4 w-4" />
          {v.role === "driver" ? "Driver readiness" : "Rider readiness"}
        </h2>
        <Badge variant={outstanding.length === 0 ? "default" : "secondary"}>
          {outstanding.length === 0 ? "All clear" : `${outstanding.length} to do`}
        </Badge>
      </div>

      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.title} className="flex items-start gap-3">
            <span className="mt-0.5">
              {s.state === "done" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : s.state === "pending" ? (
                <Clock className="h-4 w-4 text-amber-500" />
              ) : s.state === "rejected" ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : (
                <Upload className={`h-4 w-4 ${muted}`} />
              )}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium">{s.title}</p>
              <p className={`text-xs ${muted}`}>{s.detail}</p>
              {s.action && s.state !== "done" && s.state !== "pending" && (
                <Button asChild size="sm" variant="outline" className="mt-2 h-7">
                  <Link to={s.action.to}>{s.action.label}</Link>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

type Step = {
  title: string;
  detail: string;
  state: "todo" | "pending" | "done" | "rejected";
  action?: { to: string; label: string };
};

function driverSteps(v: VerificationInfo): Step[] {
  const kyc: Step =
    v.driverStatus === "approved"
      ? { title: "Driver KYC approved", detail: "Licence, vehicle and banking details verified by an admin.", state: "done" }
      : v.driverStatus === "pending"
        ? { title: "Driver KYC under review", detail: "An admin is checking your documents. You can't post rides yet.", state: "pending" }
        : v.driverStatus === "rejected"
          ? { title: "Driver KYC rejected", detail: "Fix the issues an admin flagged and resubmit your documents.", state: "rejected", action: { to: "/become-driver", label: "Resubmit documents" } }
          : { title: "Upload driver documents", detail: "Licence, vehicle registration, vehicle photos and banking details.", state: "todo", action: { to: "/become-driver", label: "Start driver KYC" } };

  return [
    kyc,
    {
      title: "Post your first ride",
      detail:
        v.driverStatus === "approved"
          ? "You're cleared to publish rides and accept riders."
          : "Unlocks as soon as your driver KYC is approved.",
      state: v.driverStatus === "approved" ? "done" : "todo",
      ...(v.driverStatus === "approved" ? { action: { to: "/post-ride", label: "Post a ride" } } : {}),
    },
  ];
}

function riderSteps(v: VerificationInfo): Step[] {
  const kyc: Step = v.verified
    ? { title: "Identity verified", detail: "You can book unlimited rides.", state: "done" }
    : v.riderStatus === "pending"
      ? { title: "Identity check under review", detail: `An admin is reviewing your ID and selfie. Until then you can hold ${v.bookingLimit} active booking.`, state: "pending" }
      : v.riderStatus === "rejected"
        ? { title: "Identity check rejected", detail: "Re-upload a clear ID document and selfie.", state: "rejected", action: { to: "/verify-identity", label: "Resubmit ID" } }
        : { title: "Verify your identity", detail: `Upload your ID and a selfie. Unverified riders are limited to ${v.bookingLimit} active booking.`, state: "todo", action: { to: "/verify-identity", label: "Verify identity" } };

  return [
    kyc,
    {
      title: "Book a ride",
      detail:
        v.bookingLimit !== null && v.activeBookings >= v.bookingLimit
          ? `Booking limit reached (${v.activeBookings}/${v.bookingLimit}). Verify your identity to book more.`
          : `You have ${v.activeBookings} active booking${v.activeBookings === 1 ? "" : "s"}.`,
      state: v.activeBookings > 0 ? "done" : "todo",
      action: { to: "/search", label: "Find a ride" },
    },
  ];
}
