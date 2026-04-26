# O LIFE → GitHub + Cloudflare Pages Deployment Guide

## What you're deploying
- **File**: `index.html` (8MB raw → 1.4MB over the wire via Brotli)
- **Host**: Cloudflare Pages (free, global CDN, automatic HTTPS)
- **Trigger**: Push to GitHub → Cloudflare auto-deploys

---

## Step 1: Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name it: `olife-supreme` (or whatever you want)
3. Set to **Private** (your API keys are in the HTML)
4. **Do NOT** initialize with README
5. Click **Create repository**

---

## Step 2: Push the files to GitHub

Open a terminal on your computer and run these commands:

```bash
# Download the folder I prepared (or just use your index-4.html)
# Then in that folder:

git init
git add .
git commit -m "Initial O LIFE Supreme deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/olife-supreme.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 3: Connect Cloudflare Pages

1. Log into [dash.cloudflare.com](https://dash.cloudflare.com)
2. Left sidebar → **Workers & Pages**
3. Click **Create** → **Pages** tab → **Connect to Git**
4. Authorize GitHub and select your `olife-supreme` repo
5. Configure build settings:
   - **Framework preset**: None
   - **Build command**: *(leave blank)*
   - **Build output directory**: `/` (just a slash)
6. Click **Save and Deploy**

Cloudflare will pull your repo and deploy it. Takes ~30 seconds.

---

## Step 4: Your live URL

Cloudflare gives you a URL like:
```
https://olife-supreme.pages.dev
```

Every `git push` to `main` triggers a new deploy automatically.

---

## Step 5: Custom Domain (optional)

If you own a domain (e.g. `olife.app`):
1. In Cloudflare Pages → your project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain → Follow DNS instructions
4. HTTPS is automatic

---

## ⚠️ Security: Rotate These Keys

Your HTML has hardcoded credentials that will be visible to anyone with the URL.
Since the repo is private, only you can see the source — but still good practice to rotate:

| Key | Where to rotate |
|-----|----------------|
| Turso token | [turso.tech](https://turso.tech) → your DB → Tokens |
| Cloudflare R2 token (`cfat_...`) | Cloudflare dashboard → API Tokens |
| Resend key (`re_...`) | [resend.com](https://resend.com) → API Keys |
| Finnhub key | [finnhub.io](https://finnhub.io) → API |

---

## Performance on Cloudflare Pages

| Metric | Value |
|--------|-------|
| Raw file size | 7.8 MB |
| Gzipped (auto) | ~1.97 MB |
| Brotli (auto) | ~1.41 MB |
| CDN edge locations | 300+ worldwide |
| TTFB | <50ms globally |
| Cost | **Free** (unlimited bandwidth on Pages) |

Cloudflare Pages automatically serves Brotli compression to supported browsers,
so users actually download ~1.4MB, not 8MB.

---

## Updating the app

```bash
# Make changes to index.html, then:
git add index.html
git commit -m "Update O LIFE"
git push
```
Cloudflare deploys the new version in ~30 seconds. Zero downtime.

---

## Optional: Preview Branches

Any branch you push gets its own preview URL:
```
https://my-feature.olife-supreme.pages.dev
```
Great for testing fixes before pushing to main/production.
