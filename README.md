# NillaFlow Studio™.

> Create. Speak. Record. Flow.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.local.example .env.local
```
Fill in your credentials in `.env.local`:
- Supabase URL + Anon Key (from Supabase → Settings → API)
- Stripe keys (from Stripe Dashboard)
- Anthropic API key

### 3. Set up Supabase database
- Go to Supabase → SQL Editor
- Paste and run `supabase-schema.sql`

### 4. Configure Supabase Auth
- Authentication → URL Configuration
  - Site URL: `https://project-wbhr2.vercel.app`
  - Redirect URLs: `https://project-wbhr2.vercel.app/auth/callback`

### 5. Run locally
```bash
npm run dev
```

## Deploy
Push to GitHub → Vercel auto-deploys.

Add all `.env.local` variables to Vercel → Settings → Environment Variables.

## Build Order
- [x] Landing page
- [x] Authentication (signup, login, password reset)
- [ ] Creator onboarding
- [ ] Dashboard
- [ ] AI content engine
- [ ] AI script engine
- [ ] Flow Teleprompter™
- [ ] Captions system
- [ ] Subscription system (Stripe)
