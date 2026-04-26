# O LIFE Supreme Intelligence OS

Deployed via Cloudflare Pages from GitHub.

## File Stats
- Raw HTML: ~8MB (343 script blocks, 47 style blocks)
- Gzipped: ~1.97MB (Cloudflare serves this automatically)
- Brotli: ~1.41MB (Cloudflare Pages serves this automatically)

## Deployment
Push to `main` branch → Cloudflare Pages auto-deploys.

## ⚠️ Security Note
Hardcoded API keys in the `_olife_autokeys_v1` script are written to localStorage
at runtime. These are semi-public. Rotate any sensitive keys:
- Turso token
- Cloudflare R2 token  
- Resend API key
- Finnhub key

## Cloudflare Pages Settings
- Build command: (none — static file)
- Output directory: / (root)
- Branch: main

## Custom Domain (optional)
Set in Cloudflare Pages → Custom domains → Add domain
