# Petinder

A shelter kennel-card matchmaker — swipe through adoptable pets, save matches, book visits, find nearby shelters, and chat with PawPal AI.

## Setup

```bash
npm install
cp .env.example .env
```

Add your OpenAI API key to `.env` (server-side only — never commit this file):

```
OPENAI_API_KEY=sk-...
```

Optional Firebase keys (for cloud login + sync across devices) are in `.env.example`.

## Run locally

```bash
npm run dev
```

Opens the app at http://localhost:5173 with the API on the same port.

### Production (self-hosted)

```bash
npm run build
npm run start
```

Visit http://localhost:3001

## Deploy to Vercel (phone-friendly URL)

1. Push this project to GitHub (create a repo, then `git push`).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.
3. Vercel should auto-detect **Vite**. Keep:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. In **Environment Variables**, add:
   - `OPENAI_API_KEY` — required for PawPal AI chat
   - Optional Firebase vars from `.env.example` if you want cloud accounts
5. Click **Deploy**. You’ll get a URL like `https://petinder-xyz.vercel.app` — open it on your phone.

Or deploy from the terminal (after `npm i -g vercel`):

```bash
npm run build
vercel
```

Follow the prompts, then add `OPENAI_API_KEY` in the Vercel project settings.

**Note:** Without Firebase, accounts save in the browser on each device (local login). Add Firebase env vars on Vercel for email login and cross-device sync.

## Features

- **Swipe** — Tinder-style kennel cards ranked by your onboarding profile + likes/dislikes
- **Matches & Visits** — Save favorites and book shelter visits
- **Map** — Real nearby shelters from OpenStreetMap
- **PawPal AI** — Chat about pet care and ask which pets fit you best (OpenAI via secure backend)

## Desktop app (.exe)

```bash
npm run electron:dev
npm run electron:build
```

## Notes

- **Sign out** — use the button in the top-right header (also on Profile).
- **Rotate your OpenAI key** if it was ever shared publicly.
- Map location requires browser permission on mobile.
