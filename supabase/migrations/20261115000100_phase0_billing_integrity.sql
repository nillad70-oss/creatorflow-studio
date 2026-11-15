-- ============================================================
-- NillaFlow Studio™ — Phase 0: billing integrity (PROPOSED for production)
-- Additive only: adds one column, one trigger, and swaps one RLS policy.
-- No existing row is modified. Safe to re-run.
--
-- Fixes found in the 2026-11-15 production schema review:
--  1. users.subscription_status did not exist, but the Stripe webhook wrote
--     it, so the whole upgrade/cancel UPDATE was rejected (paid users not
--     upgraded, cancelled users not downgraded).
--  2. RLS policy users_update_own let a signed-in user change ANY column of
--     their own row, including subscription_tier ('free' -> 'pro' without paying).
--  3. RLS policy usage_all_own let a user reset their own usage counters.
--
-- ROLLBACK: see the bottom of this file.
-- ============================================================

-- 1. Column the webhook already writes.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_status TEXT;

-- 2. Billing columns can only be set by the server (service role / postgres),
--    never by a browser session. Profile columns (niche, tone, onboarding, ...)
--    stay editable by the user exactly as before.
CREATE OR REPLACE FUNCTION public.protect_billing_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.subscription_tier      := 'free';
      NEW.stripe_customer_id     := NULL;
      NEW.stripe_subscription_id := NULL;
      NEW.subscription_status    := NULL;
      NEW.trial_ends_at          := NULL;
    ELSE
      NEW.subscription_tier      := OLD.subscription_tier;
      NEW.stripe_customer_id     := OLD.stripe_customer_id;
      NEW.stripe_subscription_id := OLD.stripe_subscription_id;
      NEW.subscription_status    := OLD.subscription_status;
      NEW.trial_ends_at          := OLD.trial_ends_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS users_protect_billing_columns ON public.users;
CREATE TRIGGER users_protect_billing_columns
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_billing_columns();

-- 3. Users may READ their own usage; only the server writes it.
DROP POLICY IF EXISTS usage_all_own ON public.usage;
DROP POLICY IF EXISTS usage_select_own ON public.usage;
CREATE POLICY usage_select_own ON public.usage FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- ROLLBACK (run only if this migration must be undone):
--   DROP TRIGGER IF EXISTS users_protect_billing_columns ON public.users;
--   DROP FUNCTION IF EXISTS public.protect_billing_columns();
--   DROP POLICY IF EXISTS usage_select_own ON public.usage;
--   CREATE POLICY usage_all_own ON public.usage FOR ALL USING (auth.uid() = user_id);
--   -- subscription_status column can stay (harmless); to remove it:
--   -- ALTER TABLE public.users DROP COLUMN IF EXISTS subscription_status;
-- ============================================================
