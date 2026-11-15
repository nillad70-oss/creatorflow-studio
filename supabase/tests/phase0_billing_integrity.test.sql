-- Database tests for 20261115000100_phase0_billing_integrity.sql
-- Run on a local Postgres after supabase_stubs.sql + both migrations.
-- Every check RAISEs on failure, so ON_ERROR_STOP makes a failure fatal.
\set ON_ERROR_STOP on
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

TRUNCATE auth.users CASCADE;
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111', 'free@test.dev');
INSERT INTO auth.users VALUES ('22222222-2222-4222-8222-222222222222', 'pro@test.dev');

-- Signup trigger still creates the profile row as 'free'.
DO $$ BEGIN
  IF (SELECT subscription_tier FROM public.users WHERE id = '11111111-1111-4111-8111-111111111111') <> 'free'
  THEN RAISE EXCEPTION 'FAIL: signup trigger did not create a free profile'; END IF;
  RAISE NOTICE 'PASS: signup creates a free profile';
END $$;

-- Server (service role) can upgrade: the webhook path still works, including subscription_status.
SET ROLE service_role;
UPDATE public.users SET subscription_tier = 'pro', stripe_customer_id = 'cus_pro', subscription_status = 'active'
 WHERE id = '22222222-2222-4222-8222-222222222222';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT subscription_tier || '/' || subscription_status FROM public.users WHERE id = '22222222-2222-4222-8222-222222222222') <> 'pro/active'
  THEN RAISE EXCEPTION 'FAIL: service role could not upgrade a user'; END IF;
  RAISE NOTICE 'PASS: server/webhook can set tier and subscription_status';
END $$;

-- Browser session: free user tries to make themselves Pro -> silently kept free.
SET ROLE authenticated; SET test.uid = '11111111-1111-4111-8111-111111111111';
UPDATE public.users SET subscription_tier = 'pro', stripe_customer_id = 'cus_fake', niche = 'Nursing'
 WHERE id = '11111111-1111-4111-8111-111111111111';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT subscription_tier FROM public.users WHERE id = '11111111-1111-4111-8111-111111111111') <> 'free'
  THEN RAISE EXCEPTION 'FAIL: user upgraded themselves to pro'; END IF;
  IF (SELECT stripe_customer_id FROM public.users WHERE id = '11111111-1111-4111-8111-111111111111') IS NOT NULL
  THEN RAISE EXCEPTION 'FAIL: user set their own stripe_customer_id'; END IF;
  RAISE NOTICE 'PASS: browser session cannot change billing columns';
  IF (SELECT niche FROM public.users WHERE id = '11111111-1111-4111-8111-111111111111') <> 'Nursing'
  THEN RAISE EXCEPTION 'FAIL: profile edits (onboarding) were blocked'; END IF;
  RAISE NOTICE 'PASS: profile/onboarding edits still work';
END $$;

-- Pro user's browser session saving their profile (e.g. signup upsert sends tier 'free') keeps Pro.
SET ROLE authenticated; SET test.uid = '22222222-2222-4222-8222-222222222222';
INSERT INTO public.users (id, email, subscription_tier, onboarding_complete)
VALUES ('22222222-2222-4222-8222-222222222222', 'pro@test.dev', 'free', false)
ON CONFLICT (id) DO UPDATE SET subscription_tier = EXCLUDED.subscription_tier, onboarding_complete = EXCLUDED.onboarding_complete;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT subscription_tier FROM public.users WHERE id = '22222222-2222-4222-8222-222222222222') <> 'pro'
  THEN RAISE EXCEPTION 'FAIL: client upsert downgraded a paying user'; END IF;
  RAISE NOTICE 'PASS: client upsert cannot downgrade a paying user';
END $$;

-- Usage counters: user can read but not write their own row.
SET ROLE service_role;
INSERT INTO public.usage (user_id, month, scripts_count) VALUES ('11111111-1111-4111-8111-111111111111', '2026-11', 5);
RESET ROLE;
SET ROLE authenticated; SET test.uid = '11111111-1111-4111-8111-111111111111';
UPDATE public.usage SET scripts_count = 0 WHERE user_id = '11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.usage) <> 1 THEN RAISE EXCEPTION 'FAIL: user cannot read own usage'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT scripts_count FROM public.usage WHERE user_id = '11111111-1111-4111-8111-111111111111') <> 5
  THEN RAISE EXCEPTION 'FAIL: user reset their own usage counter'; END IF;
  RAISE NOTICE 'PASS: usage is readable but not writable by the user';
END $$;

-- Cross-user isolation unchanged.
SET ROLE authenticated; SET test.uid = '11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.users) <> 1 THEN RAISE EXCEPTION 'FAIL: user can see other users'; END IF;
  RAISE NOTICE 'PASS: users still see only their own row';
END $$;
RESET ROLE;
