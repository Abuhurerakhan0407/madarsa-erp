# Temporary Demo Hosting — No Vercel Required

This runbook is for short-lived client demos while managed production hosting is unavailable.

## Architecture

- GitHub remains the source of truth.
- Supabase remains the database/auth/storage backend.
- The Next.js application runs locally in production mode.
- Cloudflare Quick Tunnel exposes the local production server through a temporary `trycloudflare.com` URL.
- No Cloudflare account or custom domain is required for the quick tunnel.
- This is a demo/testing path only, not the permanent production hosting model.

## Required environment

Create `.env.local` locally and provide:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
```

Never commit `.env.local` or the Supabase secret key.

## Build and run

```bash
pnpm install --no-frozen-lockfile
pnpm demo:check
pnpm demo:build
pnpm demo:start
```

The production server runs on `http://localhost:3000` by default.

## Expose the demo temporarily

Install `cloudflared`, then in a second terminal run:

```bash
cloudflared tunnel --url http://localhost:3000
```

Cloudflare prints a random HTTPS URL under `trycloudflare.com`. Share that URL only for the current demo session.

## Operational rules

1. Keep the local Next.js process and `cloudflared` process running during the demo.
2. Do not treat the temporary URL as a permanent client URL; it changes when the tunnel restarts.
3. Do not expose local development mode. Run the tested production build only.
4. Never place server secrets in browser-visible code, GitHub commits, screenshots, chat messages, or URLs.
5. Before every client demo, use the release candidate SHA that passed CI and Playwright.
6. Stop the tunnel after the demo if it is no longer needed.

## Later Vercel migration

When Vercel is available again:

1. Connect the same GitHub repository/project.
2. Set the production environment variables in Vercel.
3. Deploy the exact tested `main` SHA.
4. Run production smoke tests.
5. Point the permanent domain to the managed deployment only after verification.

No application rewrite or database migration is required solely because the temporary demo used self-hosting.
