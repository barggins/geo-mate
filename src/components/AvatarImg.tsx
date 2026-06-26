import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Cache signed URLs per path for the session
const cache = new Map<string, { url: string; exp: number }>();

async function resolve(path: string): Promise<string | null> {
  if (!path) return null;
  // Already an external URL
  if (/^https?:\/\//i.test(path)) return path;
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.exp > now) return hit.url;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
  if (!data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, exp: now + 55 * 60 * 1000 });
  return data.signedUrl;
}

export function AvatarImg({
  path,
  name,
  size = 48,
  className = "",
}: {
  path?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    if (path) resolve(path).then((u) => on && setUrl(u));
    else setUrl(null);
    return () => { on = false; };
  }, [path]);

  const initial = (name ?? "?")[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full brand-gradient font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {url ? <img src={url} alt={name ?? "avatar"} className="h-full w-full object-cover" /> : initial}
    </div>
  );
}
