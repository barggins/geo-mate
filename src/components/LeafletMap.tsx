import { useEffect, useMemo, useState } from "react";
import type LType from "leaflet";

const isBrowser = typeof window !== "undefined";

// Lazy holders — only populated in the browser.
let L: typeof LType | null = null;
let defaultIcon: LType.Icon | null = null;
let _carIcon: LType.DivIcon | null = null;
let _pickupIcon: LType.DivIcon | null = null;

function ensureLeaflet() {
  if (!isBrowser || L) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  L = require("leaflet") as typeof LType;
  defaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
  L.Marker.prototype.options.icon = defaultIcon;
  _carIcon = L.divIcon({
    className: "",
    html: `<div style="background:oklch(0.56 0.18 250);color:white;border-radius:9999px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.25);border:3px solid white;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17h10M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM23 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM3 17V8l3-5h12l3 5v9"/></svg>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
  _pickupIcon = L.divIcon({
    className: "",
    html: `<div style="background:oklch(0.72 0.19 145);color:white;border-radius:9999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.25);border:2px solid white;font-size:11px;font-weight:700;">P</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
ensureLeaflet();

// Exported as a sentinel; consumers pass these as `icon` props and they'll be
// resolved against the real icon at render time on the client.
export const carIcon = { __kind: "car" } as unknown as LType.DivIcon;
export const pickupIcon = { __kind: "pickup" } as unknown as LType.DivIcon;

function resolveIcon(icon?: LType.DivIcon | LType.Icon): LType.DivIcon | LType.Icon | undefined {
  if (!icon) return defaultIcon ?? undefined;
  const kind = (icon as unknown as { __kind?: string }).__kind;
  if (kind === "car") return _carIcon ?? undefined;
  if (kind === "pickup") return _pickupIcon ?? undefined;
  return icon;
}

export type MapMarker = {
  position: [number, number];
  icon?: LType.DivIcon | LType.Icon;
  popup?: string;
};

export type LeafletMapProps = {
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  polyline?: Array<[number, number]>;
  height?: string;
  className?: string;
  fitToContent?: boolean;
};

export default function LeafletMap(props: LeafletMapProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureLeaflet();
    setReady(true);
  }, []);

  const placeholder = (
    <div
      className={`rounded-xl border bg-muted ${props.className ?? ""}`}
      style={{ height: props.height ?? "420px" }}
    />
  );
  if (!ready || !isBrowser) return placeholder;
  return <LeafletMapInner {...props} />;
}

function LeafletMapInner({
  center,
  zoom = 13,
  markers = [],
  polyline,
  height = "420px",
  className = "",
  fitToContent = true,
}: LeafletMapProps) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RL = require("react-leaflet") as typeof import("react-leaflet");
  const { MapContainer, TileLayer, Marker, Polyline, useMap } = RL;

  const resolvedMarkers = useMemo(
    () => markers.map((m) => ({ ...m, icon: resolveIcon(m.icon) })),
    [markers],
  );

  function FitBounds() {
    const map = useMap();
    useEffect(() => {
      const pts: Array<[number, number]> = [
        ...resolvedMarkers.map((m) => m.position),
        ...(polyline ?? []),
      ];
      if (pts.length < 2) return;
      map.fitBounds(pts as LType.LatLngBoundsExpression, { padding: [40, 40] });
    }, [map]);
    return null;
  }

  return (
    <div className={`overflow-hidden rounded-xl border ${className}`} style={{ height }}>
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {resolvedMarkers.map((m, i) => (
          <Marker key={i} position={m.position} icon={m.icon} />
        ))}
        {polyline && polyline.length > 1 && (
          <Polyline positions={polyline} pathOptions={{ color: "#3b82f6", weight: 5, opacity: 0.85 }} />
        )}
        {fitToContent && <FitBounds />}
      </MapContainer>
    </div>
  );
}
