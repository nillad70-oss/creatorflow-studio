-- Tests for 20261116000000_ai_twin_foundation.sql
\set ON_ERROR_STOP on
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
TRUNCATE auth.users CASCADE;
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111', 'a@test.dev');
INSERT INTO auth.users VALUES ('22222222-2222-4222-8222-222222222222', 'b@test.dev');

-- Server creates a twin + consent for A.
SET ROLE service_role;
INSERT INTO public.twin_profiles (id, user_id, status) VALUES ('aaaaaaaa-1111-4111-8111-000000000001', '11111111-1111-4111-8111-111111111111', 'consented');
INSERT INTO public.consent_records (user_id, twin_id, consent_version, scopes, attest_self, attest_adult)
VALUES ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-000000000001', 'v1', ARRAY['professional'], true, true);
RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'PASS: server can create a twin and a consent record'; END $$;

-- Consent must be scoped and attested.
DO $$ BEGIN
  INSERT INTO public.consent_records (user_id, twin_id, consent_version, scopes, attest_self, attest_adult)
  VALUES ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-000000000001', 'v1', ARRAY['professional'], false, true);
  RAISE EXCEPTION 'FAIL: consent accepted without self attestation';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: consent requires self + adult attestation';
END $$;
DO $$ BEGIN
  INSERT INTO public.consent_records (user_id, twin_id, consent_version, scopes, attest_self, attest_adult)
  VALUES ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-000000000001', 'v1', ARRAY['anything_goes'], true, true);
  RAISE EXCEPTION 'FAIL: unknown consent scope accepted';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: only known consent scopes are accepted';
END $$;

-- Browser session: reads own, cannot read others, cannot write.
SET ROLE authenticated; SET test.uid = '22222222-2222-4222-8222-222222222222';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.twin_profiles) <> 0 THEN RAISE EXCEPTION 'FAIL: user B sees user A twin'; END IF;
  IF (SELECT count(*) FROM public.consent_records) <> 0 THEN RAISE EXCEPTION 'FAIL: user B sees user A consent'; END IF;
  RAISE NOTICE 'PASS: users cannot see other users'' twins or consent';
END $$;
DO $$ BEGIN
  INSERT INTO public.twin_profiles (user_id) VALUES ('22222222-2222-4222-8222-222222222222');
  RAISE EXCEPTION 'FAIL: browser session inserted a twin directly';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: browser sessions cannot write twin tables directly';
END $$;
DO $$ BEGIN
  INSERT INTO public.credit_ledger (user_id, entry_type, delta, balance_after) VALUES ('22222222-2222-4222-8222-222222222222', 'grant', 1000, 1000);
  RAISE EXCEPTION 'FAIL: browser session granted itself credits';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: browser sessions cannot give themselves credits';
END $$;
DO $$ BEGIN
  PERFORM public.apply_credit_entry('22222222-2222-4222-8222-222222222222', 1000, 'grant');
  RAISE EXCEPTION 'FAIL: browser session called apply_credit_entry';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: browser sessions cannot call the credit function';
END $$;
RESET ROLE;

SET ROLE authenticated; SET test.uid = '11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.twin_profiles) <> 1 THEN RAISE EXCEPTION 'FAIL: owner cannot read own twin'; END IF;
  RAISE NOTICE 'PASS: owner can read their own twin';
END $$;
RESET ROLE;

-- Credits: atomic, never negative, idempotent by reference.
SET ROLE service_role; SET test.uid = '';
DO $$
DECLARE b integer;
BEGIN
  b := public.apply_credit_entry('11111111-1111-4111-8111-111111111111', 100, 'purchase', 'cs_test_1', 'pack');
  IF b <> 100 THEN RAISE EXCEPTION 'FAIL: purchase did not add credits'; END IF;
  b := public.apply_credit_entry('11111111-1111-4111-8111-111111111111', 100, 'purchase', 'cs_test_1', 'pack');
  IF b IS NOT NULL THEN RAISE EXCEPTION 'FAIL: same Stripe session granted twice'; END IF;
  RAISE NOTICE 'PASS: a payment can only grant credits once (webhook retries are safe)';
  b := public.apply_credit_entry('11111111-1111-4111-8111-111111111111', -30, 'hold', 'job_1');
  IF b <> 70 THEN RAISE EXCEPTION 'FAIL: hold did not reserve credits'; END IF;
  b := public.apply_credit_entry('11111111-1111-4111-8111-111111111111', -500, 'hold', 'job_2');
  IF b IS NOT NULL THEN RAISE EXCEPTION 'FAIL: overdraw allowed'; END IF;
  RAISE NOTICE 'PASS: credits cannot go below zero';
  b := public.apply_credit_entry('11111111-1111-4111-8111-111111111111', 30, 'refund', 'job_1');
  IF b <> 100 THEN RAISE EXCEPTION 'FAIL: refund did not return credits'; END IF;
  RAISE NOTICE 'PASS: failed jobs refund their credits';
  IF (SELECT count(*) FROM public.credit_ledger WHERE user_id = '11111111-1111-4111-8111-111111111111') <> 3 THEN
    RAISE EXCEPTION 'FAIL: ledger does not record every change';
  END IF;
  RAISE NOTICE 'PASS: every credit change is recorded in the ledger';
END $$;
RESET ROLE;

-- Deleting a twin removes its consent and reference rows.
SET ROLE service_role;
INSERT INTO public.twin_reference_images (user_id, twin_id, storage_path, mime_type, file_size_bytes)
VALUES ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-000000000001', '1111/x.jpg', 'image/jpeg', 10);
DELETE FROM public.twin_profiles WHERE id = 'aaaaaaaa-1111-4111-8111-000000000001';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.consent_records) <> 0 OR (SELECT count(*) FROM public.twin_reference_images) <> 0 THEN
    RAISE EXCEPTION 'FAIL: deleting a twin left consent or photo records behind';
  END IF;
  IF (SELECT balance FROM public.credit_accounts WHERE user_id = '11111111-1111-4111-8111-111111111111') <> 100 THEN
    RAISE EXCEPTION 'FAIL: deleting a twin removed purchased credits';
  END IF;
  RAISE NOTICE 'PASS: deleting a twin removes its consent and photo records, keeps purchased credits';
END $$;

-- Buckets exist and are private.
DO $$ BEGIN
  IF (SELECT count(*) FROM storage.buckets WHERE id IN ('twin-references','generated-media') AND public = false) <> 2 THEN
    RAISE EXCEPTION 'FAIL: AI Twin buckets missing or public';
  END IF;
  RAISE NOTICE 'PASS: AI Twin storage buckets exist and are private';
END $$;
