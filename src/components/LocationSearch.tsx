import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { geocode, type GeocodeResult } from "@/lib/geo";
import { Loader2, MapPin } from "lucide-react";

export function LocationSearch({
  value,
  onChange,
  placeholder,
}: {
  value: GeocodeResult | null;
  onChange: (r: GeocodeResult | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState(value?.label ?? "");
  const [opts, setOpts] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQ(value?.label ?? ""); }, [value]);

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={placeholder}
          value={q}
          onChange={(e) => {
            const v = e.target.value;
            setQ(v);
            if (value) onChange(null);
            if (debounce.current) clearTimeout(debounce.current);
            if (v.length < 3) { setOpts([]); return; }
            setLoading(true);
            debounce.current = setTimeout(async () => {
              const r = await geocode(v);
              setOpts(r); setOpen(r.length > 0); setLoading(false);
              // Auto-select the top match so the form is usable even if
              // the user doesn't click a suggestion.
              if (r.length > 0) onChange(r[0]);
            }, 350);
          }}
          onFocus={() => opts.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {open && opts.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover shadow-lg">
          {opts.map((o, i) => (
            <button
              key={i}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => { onChange(o); setQ(o.label); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
