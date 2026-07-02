export function Logo({ className = "h-12 w-auto", showTagline = false }: { className?: string; showTagline?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img
        src="/liftclub-logo.jpeg"
        alt="LiftClub"
        className={className}
        width={160}
        height={48}
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
      {showTagline && (
        <span className="hidden text-xs text-muted-foreground sm:inline">Share the Ride. Save Together.</span>
      )}
    </div>
  );
}
