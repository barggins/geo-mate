# Deploying LiftClub to Vercel + liftclub.co.za

This app supports **two deployment targets simultaneously**:

1. **Lovable** — click Publish (works out of the box, uses Lovable Cloud backend).
2. **Vercel** — SSR via `@tanstack/react-start` with the `vercel` Nitro preset.

Both point at the **same** Lovable Cloud database, so users, rides, chats,
and realtime work identically on both URLs.

---

## 1. Push to GitHub

Top-right of the Lovable editor → **GitHub → Connect project** → create the repo.

## 2. Import into Vercel

1. https://vercel.com/new → import the GitHub repo.
2. Framework Preset: **Other** (leave it — `vercel.json` handles it).
3. Build command: `vite build` (already set).
4. Output directory: leave blank (Nitro `vercel` preset writes `.vercel/output`).

## 3. Environment Variables (Vercel → Project → Settings → Environment Variables)

Add these for **Production, Preview, and Development**:

| Name | Value |
| ---- | ----- |
| `VITE_SUPABASE_URL` | `https://pbokayzmcpgkpokjrige.supabase.co` |
| `VITE_SUPABASE_PROJECT_ID` | `pbokayzmcpgkpokjrige` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | *(copy from `.env`)* |
| `SUPABASE_URL` | `https://pbokayzmcpgkpokjrige.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | *(same publishable key)* |

### ⚠️ About `SUPABASE_SERVICE_ROLE_KEY`

Lovable Cloud does **not** expose the service role key. On Vercel, any server
function that uses `supabaseAdmin` (admin ops) will 500. Everything else —
sign-in, posting rides, search, chat, realtime, SOS, presence, ratings —
works because it uses the publishable key + RLS.

If you later need full admin features on Vercel, migrate to your own Supabase
project and paste its `SUPABASE_SERVICE_ROLE_KEY` here.

## 4. Deploy

Click **Deploy**. First build takes ~2 min.

## 5. Connect liftclub.co.za

1. Register the domain at a South African registrar (Afrihost, Domains.co.za, Hetzner ZA).
2. Vercel → Project → **Settings → Domains → Add** → `liftclub.co.za` and `www.liftclub.co.za`.
3. Vercel shows you the exact DNS records. At your registrar:
   - `A    @    76.76.21.21`
   - `CNAME www  cname.vercel-dns.com`
4. SSL provisions automatically once DNS propagates (up to 24h, usually minutes).

## 6. Google OAuth redirect URLs

In Lovable Cloud auth settings, add both origins as allowed redirect URLs:
- `https://liftclub.co.za`
- `https://www.liftclub.co.za`
- `https://geo-mate.lovable.app` (Lovable publish)
- `https://<your-project>.vercel.app` (Vercel preview)
