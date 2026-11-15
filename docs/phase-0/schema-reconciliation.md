# Database Schema Reconciliation: Phase 0

**Source of truth:** a read-only export of the live database (2026-11-15), saved as `production-schema-export-2026-11-15.csv`. It contains structure only, no customer records. Nothing was reconstructed from assumptions; the only items not confirmed by the export (3 performance indexes) are labelled in the baseline migration.

## The objects the audit flagged

| Object | In repo SQL? | In production? | Actual definition |
|---|---|---|---|
| `story_profiles` | No | ✅ Yes | 11 columns incl. `is_current`, `note`; CHECKs on `goal_type` (income_replacement, education_savings, career_freedom, legacy, debt_freedom, other) and `voice_track` (personal, brand_joint, other); RLS `story_profiles_all_own`; `updated_at` trigger |
| `get_current_story()` | No | ✅ Yes | SECURITY DEFINER; returns the row where `is_current = TRUE` |
| `set_current_story()` | No | ✅ Yes | SECURITY DEFINER; clears `is_current`, sets it on the given story **only if it belongs to the given user** |
| `comment_intent_log` | No | ✅ Yes | 12 columns incl. `human_reply_sent`; RLS `comment_intent_log_all_own` |
| `users.subscription_status` | No | ❌ **Missing** | The original webhook writes it, so its updates fail (see finding 1) |

Also present in production but not in the repo: `users.handles` (jsonb), `story_profiles.note`, `comment_intent_log.human_reply_sent`, and the `creative_sessions` constraint already widened to adcopy/script/captions.

## Findings from the production schema

### Finding 1 (critical): payment upgrades and cancellations were silently failing
The original `pages/api/stripe/webhook.js` (commit 723a28f) updates `subscription_tier`, `stripe_customer_id` **and** `subscription_status` in one call. Production has no `subscription_status` column. Supabase rejects an update that names an unknown column, so **the whole update fails**, and the original code never checked the error.

Expected effect since launch, unless accounts were corrected by hand:
- Customers who completed checkout were **not upgraded to Pro**, and their `stripe_customer_id` was not saved.
- Cancellations did not downgrade anyone (and could not be matched, since no customer IDs were saved).

**Needs confirming** with the read-only impact query, compared against active subscriptions in Stripe.

**Fix:** migration `20261115000100` adds the column. The new webhook also retries without that column if it's missing, checks every database error, and returns 500 so Stripe redelivers instead of losing the event. Paying customers already affected need a one-time, approved correction, matched from Stripe; that's a production data change, so it isn't done in Phase 0.

### Finding 2 (critical): any user could make themselves Pro
RLS policy `users_update_own` allows a signed-in user to update **every column** of their own row. With only the public key and their own login, a free user can set `subscription_tier = 'pro'` from the browser console. **This was reproduced on a local database built from the export.**

**Fix:** trigger `users_protect_billing_columns`. Browser sessions can still edit profile fields (niche, tone, onboarding and so on), but billing columns (`subscription_tier`, Stripe IDs, `subscription_status`, `trial_ends_at`) can only be changed by the server.

### Finding 3 (medium): users could reset their own usage counters
Policy `usage_all_own` grants full write access. **Fix:** replaced with read-only `usage_select_own`; the server writes usage.

## Migrations (versioned, in `supabase/migrations/`)

| File | Purpose | Production? |
|---|---|---|
| `20261115000000_baseline_production_schema.sql` | Exact rebuild of today's production schema, for dev, test and disaster recovery | **Never run on production** (it already matches) |
| `20261115000100_phase0_billing_integrity.sql` | Findings 1–3. Additive; no existing row modified; rollback included | **Proposed**; awaits approval and a verified backup |

## Testing

`scripts/test-db.sh` builds a throwaway Postgres with Supabase stand-ins, applies both migrations twice (they are idempotent) and runs `supabase/tests/phase0_billing_integrity.test.sql`. It runs in CI on every push. **7/7 pass:**
- signup creates a free profile
- the server/webhook can set tier and status
- a browser session cannot change billing columns
- profile/onboarding edits still work
- a client upsert cannot downgrade a paying user
- usage is readable but not writable by the user
- users still see only their own row

`supabase/dev-setup.sql` = baseline + Phase 0 migration, to paste into the **nillaflow-dev** SQL editor.

> The four root-level `supabase-schema*.sql` files are kept for history but are **superseded and incomplete** (they miss `story_profiles`, `comment_intent_log` and the story functions). Use `supabase/migrations/` instead. Proposed for deletion once approved.
