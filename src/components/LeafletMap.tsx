import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import type L from "leaflet";

const isBrowser = typeof window !== "undefined";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LL: typeof L | undefined = isBrowser ? require("leaflet") : undefined;

// Fix default marker icons (only in the browser).
const defaultIcon = LL
  ? LL.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    })
  : (undefined as unknown as L.Icon);
if (LL && defaultIcon) LL.Marker.prototype.options.icon = defaultIcon;

export const carIcon = LL
  ? LL.divIcon({
      className: "",
      html: `<div style="background:oklch(0.56 0.18 250);color:white;border-radius:9999px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.25);border:3px solid white;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17h10M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM23 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM3 17V8l3-5h12l3 5v9"/></svg>
      </div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    })
  : (undefined as unknown as L.DivIcon);

export const pickupIcon = LL
  ? LL.divIcon({
      className: "",
      html: `<div style="background:oklch(0.72 0.19 145);color:white;border-radius:9999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.25);border:2px solid white;font-size:11px;font-weight:700;">P</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })
  : (undefined as unknown as L.DivIcon);

export type MapMarker = {
  position: [number, number];
  icon?: L.DivIcon | L.Icon;
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

function FitBounds({ markers, polyline }: { markers: MapMarker[]; polyline?: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    const pts: Array<[number, number]> = [...markers.map((m) => m.position), ...(polyline ?? [])];
    if (pts.length < 2) return;
    map.fitBounds(pts as L.LatLngBoundsExpression, { padding: [40, 40] });
  }, [map, markers, polyline]);
  return null;
}

export default function LeafletMap({
  center,
  zoom = 13,
  markers = [],
  polyline,
  height = "420px",
  className = "",
  fitToContent = true,
}: LeafletMapProps) {
  if (!isBrowser) return <div className={`rounded-xl border bg-muted ${className}`} style={{ height }} />;
  return (
    <div className={`overflow-hidden rounded-xl border ${className}`} style={{ height }}>
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m, i) => (
          <Marker key={i} position={m.position} icon={m.icon ?? defaultIcon} />
        ))}
        {polyline && polyline.length > 1 && (
          <Polyline positions={polyline} pathOptions={{ color: "#3b82f6", weight: 5, opacity: 0.85 }} />
        )}
        {fitToContent && <FitBounds markers={markers} polyline={polyline} />}
      </MapContainer>
    </div>
  );
}
