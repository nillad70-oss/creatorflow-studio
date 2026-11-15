-- Tests for 20261115000200_lock_down_definer_functions.sql
\set ON_ERROR_STOP on
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
TRUNCATE auth.users CASCADE;
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111', 'a@test.dev');
INSERT INTO auth.users VALUES ('22222222-2222-4222-8222-222222222222', 'b@test.dev');
INSERT INTO public.story_profiles (id, user_id, story_beats, is_current) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '{"origin":"A-SECRET"}', true),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '{"origin":"A-v2"}', false),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '{"origin":"B"}', true);

-- Signed-out visitor cannot read anyone's story.
SET ROLE anon;
DO $$ BEGIN
  PERFORM * FROM public.get_current_story('11111111-1111-4111-8111-111111111111');
  RAISE EXCEPTION 'FAIL: anon could call get_current_story';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: signed-out visitor cannot read stories';
END $$;
DO $$ BEGIN
  PERFORM public.set_current_story('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'FAIL: anon could call set_current_story';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: signed-out visitor cannot switch stories';
END $$;
RESET ROLE;

-- Signed-in user B cannot read or switch user A's story.
SET ROLE authenticated; SET test.uid = '22222222-2222-4222-8222-222222222222';
DO $$ BEGIN
  PERFORM * FROM public.get_current_story('11111111-1111-4111-8111-111111111111');
  RAISE EXCEPTION 'FAIL: user B read user A story';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: signed-in user cannot read another user''s story';
END $$;
DO $$ BEGIN
  PERFORM public.set_current_story('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'FAIL: user B switched user A story';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: signed-in user cannot switch another user''s story';
END $$;
RESET ROLE;

-- Signed-in user A can still switch their own story (my-story / build-story pages).
SET ROLE authenticated; SET test.uid = '11111111-1111-4111-8111-111111111111';
SELECT public.set_current_story('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT id FROM public.story_profiles WHERE user_id = '11111111-1111-4111-8111-111111111111' AND is_current) <> 'aaaaaaaa-0000-4000-8000-000000000002'
  THEN RAISE EXCEPTION 'FAIL: owner could not switch own story'; END IF;
  RAISE NOTICE 'PASS: owner can still switch their own story';
END $$;

-- Server (service role) can still read any user's current story (lib/storyContext.js).
SET ROLE service_role; SET test.uid = '';
DO $$ BEGIN
  IF (SELECT story_beats->>'origin' FROM public.get_current_story('22222222-2222-4222-8222-222222222222')) <> 'B'
  THEN RAISE EXCEPTION 'FAIL: server could not read story'; END IF;
  RAISE NOTICE 'PASS: server can still read stories for generation';
END $$;
RESET ROLE;

-- Signup trigger still creates profiles.
INSERT INTO auth.users VALUES ('33333333-3333-4333-8333-333333333333', 'c@test.dev');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = '33333333-3333-4333-8333-333333333333')
  THEN RAISE EXCEPTION 'FAIL: signup trigger broken'; END IF;
  RAISE NOTICE 'PASS: signup still creates a profile';
END $$;
