// @lovable.dev/vite-tanstack-config includes tanstackStart, viteReact, tailwindcss,
// tsConfigPaths, nitro (Cloudflare default), componentTagger, env injection, path alias,
// and error plugins. Do not add them manually.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// When building on Vercel (VERCEL=1 is set automatically in Vercel CI),
// switch the Nitro preset so SSR is emitted as a Vercel serverless function.
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: isVercel ? { preset: "vercel" } : undefined,
});
