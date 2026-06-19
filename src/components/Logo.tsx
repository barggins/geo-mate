import logoAsset from "@/assets/liftclub-logo.asset.json";

export function Logo({ className = "h-12 w-auto", showTagline = false }: { className?: string; showTagline?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img src={logoAsset.url} alt="LiftClub" className={className} />
      {showTagline && (
        <span className="hidden text-xs text-muted-foreground sm:inline">Share the Ride. Save Together.</span>
      )}
    </div>
  );
}
