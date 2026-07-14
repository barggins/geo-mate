import { useEffect, useRef, useState } from "react";
import { Star, MapPin } from "lucide-react";

/**
 * Dispatch-console hero: real street photo + SVG route that draws itself,
 * with a car marker traveling the path and an ETA counter in mono.
 */
export function RouteHero() {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [len, setLen] = useState(0);
  const [eta, setEta] = useState(72); // minutes

  useEffect(() => {
    if (pathRef.current) setLen(pathRef.current.getTotalLength());
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setEta((m) => (m <= 1 ? 72 : m - 1));
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  const h = Math.floor(eta / 60);
  const m = eta % 60;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[color:var(--asphalt)]/10 bg-[color:var(--asphalt)] shadow-2xl">
      {/* Real street photo — Cape Town dawn commute */}
      <img
        src="https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1600&q=70"
        alt="City street at dawn"
        className="absolute inset-0 h-full w-full object-cover opacity-70"
        loading="eager"
        decoding="async"
      />
      {/* Legibility gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[color:var(--asphalt)]/40 via-[color:var(--asphalt)]/20 to-[color:var(--asphalt)]/95" />

      {/* Route overlay */}
      <svg viewBox="0 0 800 500" className="relative h-[440px] w-full md:h-[520px]" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Ghost path */}
        <path
          d="M 40 420 C 180 380, 260 300, 340 300 S 520 340, 600 260 S 740 120, 780 80"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="2 10"
        />
        {/* Live route */}
        <path
          ref={pathRef}
          data-animate
          d="M 40 420 C 180 380, 260 300, 340 300 S 520 340, 600 260 S 740 120, 780 80"
          fill="none"
          stroke="var(--signal)"
          strokeWidth="5"
          strokeLinecap="round"
          filter="url(#glow)"
          style={{
            strokeDasharray: len,
            strokeDashoffset: len,
            animation: len ? "route-draw 2.6s ease-out forwards" : undefined,
          }}
        />
        {/* Endpoints */}
        <circle cx="40" cy="420" r="8" fill="var(--concrete)" />
        <circle cx="40" cy="420" r="3" fill="var(--asphalt)" />
        <circle cx="780" cy="80" r="9" fill="var(--signal)" />
        <circle cx="780" cy="80" r="3" fill="var(--asphalt)" />

        {/* Car marker traveling the path */}
        {len > 0 && (
          <g>
            <animateMotion
              dur="8s"
              repeatCount="indefinite"
              path="M 40 420 C 180 380, 260 300, 340 300 S 520 340, 600 260 S 740 120, 780 80"
              rotate="auto"
            >
            </animateMotion>
            <rect x="-11" y="-6" width="22" height="12" rx="3" fill="var(--concrete)" stroke="var(--asphalt)" strokeWidth="1.5" />
          </g>
        )}
      </svg>

      {/* LIVE pill */}
      <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-[color:var(--transit)]/40 bg-[color:var(--asphalt)]/70 px-3 py-1.5 backdrop-blur">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--transit)] opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--transit)]" />
        </span>
        <span className="font-mono-num text-[11px] font-medium uppercase tracking-widest text-white">LIVE · 08:42</span>
      </div>

      {/* Endpoint labels */}
      <div className="pointer-events-none absolute left-4 bottom-40 rounded-md bg-[color:var(--asphalt)]/85 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-white/90 backdrop-blur">
        Reading
      </div>
      <div className="pointer-events-none absolute right-4 top-16 rounded-md bg-[color:var(--signal)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--asphalt)]">
        London Bridge
      </div>

      {/* Bottom info bar */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 border-t border-white/10 bg-[color:var(--asphalt)]/95 px-5 py-4 backdrop-blur">
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-sm font-semibold text-white">
            <MapPin className="h-3.5 w-3.5 text-[color:var(--signal)]" />
            Reading → London Bridge
          </p>
          <p className="mt-1 flex items-center gap-3 text-[11px] uppercase tracking-wider text-white/60">
            <span className="font-mono-num">4.2 km detour</span>
            <span className="text-white/25">·</span>
            <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-[color:var(--signal)] text-[color:var(--signal)]" /> 4.9</span>
            <span className="text-white/25">·</span>
            <span className="font-mono-num text-[color:var(--transit)]">2 seats</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-widest text-white/50">ETA</p>
          <p className="font-mono-num text-2xl font-semibold leading-none text-white" style={{ animation: "eta-pulse 2s ease-in-out infinite" }}>
            {h}h {String(m).padStart(2, "0")}m
          </p>
        </div>
      </div>
    </div>
  );
}
