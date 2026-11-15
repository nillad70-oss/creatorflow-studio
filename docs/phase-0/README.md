# NillaFlow Studio™ — Phase 0 Security Hardening

Branch: `phase-0-security-hardening` · Baseline: `main` @ `723a28f` (verified identical on GitHub, the owner's Mac and the build workspace on 2026-11-15).
Nothing here is merged, deployed or applied to the production database.

## Status by directive step

| Step | Status | Notes |
|---|---|---|
| 1. Safe dev environment | 🟡 Mostly complete | Branch ✅ · dev Supabase `nillaflow-dev` ✅ · production secrets made Production-only in Vercel ✅ · Preview → dev database ⏳ (branch-scoped Preview variables) · production schema export ⏳ · backup procedure ⏳ |
| 2. Authentication fixes | ✅ Complete (in branch) | All acceptance criteria covered by tests below |
| 3. Regression tests | ✅ API layer complete | 16 baseline workflow tests pass before and after; UI flows to be verified manually on the preview |
| 4. Schema reconciliation | ✅ Complete (migration awaiting approval) | Production export received; baseline + Phase 0 migrations tested locally (7/7). **Two critical findings** (payment upgrades failing silently; users can self-upgrade to Pro). See `schema-reconciliation.md` |
| 5. Billing & usage | ✅ Prepared (in branch) | Pricing, trial and products unchanged; usage enforcement OFF by default |
| 6. Repo maintenance | ✅ Partial | Stray files removed, CI added; remaining items need approval (below) |
| 7. AI Twin readiness | ✅ Documented | See the Current-State Audit report §5; no AI Twin code written |

## Test results

| Suite | Before (723a28f) | After |
|---|---|---|
| Baseline workflows (ideas, script, story, captions, ad copy, intent, upload, analysis, refinement, checkout) | 16/16 pass | 16/16 pass |
| Security (401s, cross-user access, spoofed user_id, upload validation, Stripe identity, webhook signature) | 2/34 pass | 34/34 pass |
| Billing lifecycle (trial, renewal, failed payment, recovery, unpaid, cancel, portal) | n/a (new) | 16/16 pass |
| Usage limits & rate limiting | n/a (new) | 8/8 pass |
| **Total** | | **74/74 pass** |

Full listings: `test-results-BEFORE-723a28f.txt`, `test-results-AFTER.txt`. Run with `npm test`. All external services are faked: no network calls, no AI charges, no Stripe calls.

Additional checks: `next build` succeeds; `scripts/check-no-secrets-in-bundle.sh` confirms no server secret appears in any browser file.

## Changes, by file

| Area | Files | Status |
|---|---|---|
| Server identity check (token-only identity, service role server-only) | `lib/server/auth.js` (new) | Complete |
| Rate limits + input length validation | `lib/server/guard.js` (new) | Complete (per-instance; see risks) |
| AI routes require a session, ignore body `user_id` | `pages/api/generate-{ideas,script,captions,adcopy}.js` | Complete |
| Ownership checks | `pages/api/enhance-story.js`, `session-refine.js`, `analyze-asset.js` | Complete |
| Upload hardening (real size, magic bytes, stream cap) | `pages/api/upload-asset.js` | Complete |
| Intent engine: user session OR ReplyRush service key | `pages/api/intent-engine.js` | Complete — **deploy dependency**: set `INTENT_ENGINE_SERVICE_KEY` in Vercel and ReplyRush first |
| Browser sends session token | `lib/authFetch.js` (new), `pages/{adcopy,build-story,captions,planner,scripts,scripts_clean}.js` | Complete |
| Members-only page guard | `lib/AuthGate.js` (new), `pages/_app.js` | Complete |
| Stripe checkout identity + price allowlist | `lib/server/plans.js` (new), `pages/api/stripe/checkout/index.js`, `checkout-signup.js`, `pages/signup.js` | Complete |
| Subscription lifecycle webhook | `pages/api/stripe/webhook.js` | Complete — needs extra events enabled on the Stripe webhook endpoint at deploy |
| Self-service billing | `pages/api/stripe/portal.js` (new), `pages/settings/billing.js` | Complete — needs Customer Portal switched on in Stripe |
| Usage metering (enforcement flag) | `lib/server/usage.js` (new) | Complete — enabling enforcement awaits approval |
| Teleprompter DEBUG popups removed | `pages/teleprompter.js` | Complete |
| Trial copy matches checkout (card required) | `pages/index.js` | Complete — marketing site has the same claim (not in this repo) |
| Stray files removed | `pages/.!42976!scripts.js` (was a live route), `main`, `next`, `creatorflow-studio@1.0.0`, `lib/supabase/server.js` | Complete |
| CI | `.github/workflows/ci.yml`, `scripts/check-no-secrets-in-bundle.sh` | Complete |

## Route protection: why middleware stays off

`middleware.js.bak` checked for a Supabase auth cookie. This app's Supabase client keeps the session in browser `localStorage`, so no such cookie exists, and the middleware redirected signed-in users to /login. That is why it was disabled. Re-enabling it would lock everyone out. Protection is now:
1. **Server:** every protected API route verifies the session token (the real security boundary).
2. **Database:** Row Level Security on every table.
3. **Browser:** `AuthGate` redirects signed-out visitors on members-only pages (user experience).

Moving to cookie sessions (`@supabase/ssr`) would allow true server-side page protection; recommended as a later, separately tested change.

## Deployment prerequisites (before any production release)

1. `INTENT_ENGINE_SERVICE_KEY` set in Vercel (Production) and in ReplyRush, if ReplyRush calls the intent engine today.
2. Stripe webhook endpoint: add events `customer.subscription.created`, `customer.subscription.updated`, `invoice.payment_failed`, `invoice.paid` (existing: `checkout.session.completed`, `customer.subscription.deleted`).
3. Stripe Customer Portal enabled (Settings → Billing → Customer portal).
4. Verified backup taken, then migration `20261115000100_phase0_billing_integrity.sql` applied to production (approval required).
6. One-time correction for paying customers who were never upgraded (Finding 1), matched from Stripe (approval required).
5. Users with an open tab will need one page refresh after release (old JavaScript does not send the token; first API call returns "Please sign in").

## Awaiting approval

- Delete `pages/scripts_clean.js` (unlinked duplicate, live at `/scripts_clean`) and `middleware.js.bak`.
- Enable `USAGE_LIMITS_ENFORCED=true` (review counted usage first).
- Marketing site copy: "No credit card required" (`nillaflow-studio-marketing/app/page.tsx:216`).
- Dependency alignment: `eslint-config-next` 14.2.0 vs Next 16 (`next lint` removed in Next 16; lint script is currently non-functional).
- Make both repositories private (recommended: prompts, compliance logic and security code are publicly readable).

## Remaining risks

- Rate limits are per server instance; a shared store (e.g. Upstash Redis) is needed for global limits before paid AI Twin features.
- Upload: Vercel caps request bodies at ~4.5 MB, below the 5 MB image limit once base64-encoded (pre-existing; consider direct-to-storage signed uploads).
- Paying customers may currently be on the free tier because of Finding 1; impact not yet measured.
- No automated UI tests yet; UI flows must be clicked through on the isolated preview.
