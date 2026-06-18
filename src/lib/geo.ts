// Geocoding & routing via free OpenStreetMap services (Nominatim + OSRM).
// Used purely from the browser; for production scale add your own caching / Mapbox token.

export type LatLng = { lat: number; lng: number };

export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
};

export async function geocode(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!r.ok) return [];
  const json = (await r.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return json.map((x) => ({ label: x.display_name, lat: parseFloat(x.lat), lng: parseFloat(x.lon) }));
}

export type Route = {
  /** [lng, lat] pairs along the route */
  coords: Array<[number, number]>;
  distanceMeters: number;
  durationSeconds: number;
};

/** Driving directions from OSRM public demo server. */
export async function getRoute(from: LatLng, to: LatLng): Promise<Route | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const json = await r.json();
  const route = json.routes?.[0];
  if (!route) return null;
  return {
    coords: route.geometry.coordinates as Array<[number, number]>,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

/** WKT LINESTRING string for inserting into PostGIS geography column. */
export function coordsToWKT(coords: Array<[number, number]>): string {
  // OSRM gives [lng, lat]; WKT also uses "lng lat".
  return `LINESTRING(${coords.map(([lng, lat]) => `${lng} ${lat}`).join(",")})`;
}

export function pointToWKT(p: LatLng): string {
  return `POINT(${p.lng} ${p.lat})`;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatDuration(s: number): string {
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}
