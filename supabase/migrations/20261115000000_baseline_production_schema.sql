-- ============================================================
-- NillaFlow Studio™ — BASELINE: production schema as it exists today
-- Source: read-only export of the live database, 2026-11-15
--         (docs/phase-0/production-schema-export-2026-11-15.csv)
--
-- Purpose: rebuild an identical empty database (dev / test / disaster
-- recovery). This file is NOT to be run against production: production
-- already has all of this. Every statement is idempotent anyway.
--
-- Everything below matches the export exactly, except where marked
-- "[repo, not in export]": indexes are not covered by the export query and
-- come from the original repo SQL files. They are performance-only.
-- ============================================================

-- ── Tables ──
CREATE TABLE IF NOT EXISTS public.users (
  id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                  TEXT NOT NULL,
  niche                  TEXT,
  audience               TEXT,
  content_goals          TEXT,
  tone                   TEXT,
  creator_level          TEXT DEFAULT 'beginner',
  preferred_platform     TEXT DEFAULT 'instagram',
  content_category       TEXT,
  handles                JSONB DEFAULT '{}'::jsonb,
  subscription_tier      TEXT DEFAULT 'free',
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at          TIMESTAMPTZ,
  onboarding_complete    BOOLEAN DEFAULT FALSE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT users_stripe_customer_id_key UNIQUE (stripe_customer_id),
  CONSTRAINT users_subscription_tier_check CHECK (subscription_tier = ANY (ARRAY['free'::text, 'pro'::text]))
);

CREATE TABLE IF NOT EXISTS public.scripts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  topic       TEXT,
  hook        TEXT,
  body        TEXT,
  cta         TEXT,
  pacing      TEXT,
  script_mode TEXT DEFAULT 'educational',
  platform    TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.content_calendar (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic        TEXT NOT NULL,
  hook         TEXT,
  category     TEXT,
  platform     TEXT,
  content_type TEXT,
  publish_date DATE,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.captions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  script_id     UUID REFERENCES public.scripts(id) ON DELETE SET NULL,
  subtitle_text TEXT,
  export_format TEXT DEFAULT 'plain',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.usage (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month          TEXT NOT NULL,
  scripts_count  INTEGER DEFAULT 0,
  ideas_count    INTEGER DEFAULT 0,
  captions_count INTEGER DEFAULT 0,
  CONSTRAINT usage_user_id_month_key UNIQUE (user_id, month)
);

CREATE TABLE IF NOT EXISTS public.story_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version          INTEGER NOT NULL DEFAULT 1,
  goal_type        TEXT,
  voice_track      TEXT DEFAULT 'personal',
  story_beats      JSONB NOT NULL DEFAULT '{}'::jsonb,
  compliance_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_current       BOOLEAN DEFAULT FALSE,
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT story_profiles_goal_type_check CHECK (goal_type = ANY (ARRAY['income_replacement'::text, 'education_savings'::text, 'career_freedom'::text, 'legacy'::text, 'debt_freedom'::text, 'other'::text])),
  CONSTRAINT story_profiles_voice_track_check CHECK (voice_track = ANY (ARRAY['personal'::text, 'brand_joint'::text, 'other'::text]))
);

CREATE TABLE IF NOT EXISTS public.comment_intent_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  comment_id        TEXT,
  platform          TEXT,
  comment_text      TEXT NOT NULL,
  classified_intent TEXT,
  objection_type    TEXT,
  confidence        NUMERIC,
  reply_text        TEXT,
  needs_human_reply BOOLEAN DEFAULT FALSE,
  human_reply_sent  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.creative_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_type     TEXT DEFAULT 'adcopy',
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT creative_sessions_session_type_check CHECK (session_type = ANY (ARRAY['adcopy'::text, 'script'::text, 'captions'::text]))
);

CREATE TABLE IF NOT EXISTS public.session_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.creative_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT session_messages_role_check CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text]))
);

CREATE TABLE IF NOT EXISTS public.assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,
  asset_type      TEXT DEFAULT 'image',
  mime_type       TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  ai_analysis     JSONB,
  analyzed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT assets_asset_type_check CHECK (asset_type = ANY (ARRAY['image'::text, 'screenshot'::text, 'product_image'::text, 'brand_graphic'::text]))
);

-- ── Indexes [repo, not in export] ──
CREATE INDEX IF NOT EXISTS idx_assets_user ON public.assets (user_id);
CREATE INDEX IF NOT EXISTS idx_creative_sessions_user ON public.creative_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_session ON public.session_messages (session_id, created_at);

-- ── Row Level Security ──
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_calendar   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_intent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets             ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS users_insert_own ON public.users;
CREATE POLICY users_insert_own ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS scripts_all_own ON public.scripts;
CREATE POLICY scripts_all_own ON public.scripts FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS calendar_all_own ON public.content_calendar;
CREATE POLICY calendar_all_own ON public.content_calendar FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS captions_all_own ON public.captions;
CREATE POLICY captions_all_own ON public.captions FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS usage_all_own ON public.usage;
CREATE POLICY usage_all_own ON public.usage FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS story_profiles_all_own ON public.story_profiles;
CREATE POLICY story_profiles_all_own ON public.story_profiles FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS comment_intent_log_all_own ON public.comment_intent_log;
CREATE POLICY comment_intent_log_all_own ON public.comment_intent_log FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS creative_sessions_all_own ON public.creative_sessions;
CREATE POLICY creative_sessions_all_own ON public.creative_sessions FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS session_messages_all_via_session ON public.session_messages;
CREATE POLICY session_messages_all_via_session ON public.session_messages FOR ALL
  USING (session_id IN (SELECT creative_sessions.id FROM public.creative_sessions WHERE creative_sessions.user_id = auth.uid()));
DROP POLICY IF EXISTS assets_all_own ON public.assets;
CREATE POLICY assets_all_own ON public.assets FOR ALL USING (auth.uid() = user_id);

-- ── Functions (verbatim from production) ──
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_usage_limit(p_user_id uuid, p_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_tier TEXT;
  v_count INTEGER;
  v_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
BEGIN
  SELECT subscription_tier INTO v_tier FROM public.users WHERE id = p_user_id;

  -- Pro users have unlimited access
  IF v_tier = 'pro' THEN RETURN TRUE; END IF;

  -- Free tier limits
  SELECT
    CASE p_type
      WHEN 'scripts' THEN scripts_count
      WHEN 'ideas'   THEN ideas_count
      WHEN 'captions' THEN captions_count
    END
  INTO v_count
  FROM public.usage
  WHERE user_id = p_user_id AND month = v_month;

  IF v_count IS NULL THEN RETURN TRUE; END IF; -- No usage yet

  -- Free limits: 5 scripts, 5 ideas, 3 captions per month
  CASE p_type
    WHEN 'scripts'  THEN RETURN v_count < 5;
    WHEN 'ideas'    THEN RETURN v_count < 5;
    WHEN 'captions' THEN RETURN v_count < 3;
  END CASE;

  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_story(p_user_id uuid)
 RETURNS TABLE(id uuid, goal_type text, voice_track text, story_beats jsonb, compliance_flags jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT sp.id, sp.goal_type, sp.voice_track, sp.story_beats, sp.compliance_flags
  FROM public.story_profiles sp
  WHERE sp.user_id = p_user_id AND sp.is_current = TRUE
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_current_story(p_user_id uuid, p_story_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.story_profiles
  SET is_current = FALSE
  WHERE user_id = p_user_id AND is_current = TRUE;

  UPDATE public.story_profiles
  SET is_current = TRUE
  WHERE id = p_story_id AND user_id = p_user_id;
END;
$function$;

-- ── Triggers ──
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS scripts_updated_at ON public.scripts;
CREATE TRIGGER scripts_updated_at BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS story_profiles_updated_at ON public.story_profiles;
CREATE TRIGGER story_profiles_updated_at BEFORE UPDATE ON public.story_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS creative_sessions_updated_at ON public.creative_sessions;
CREATE TRIGGER creative_sessions_updated_at BEFORE UPDATE ON public.creative_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Storage ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-assets', 'user-assets', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS user_assets_select_own ON storage.objects;
CREATE POLICY user_assets_select_own ON storage.objects FOR SELECT
  USING (bucket_id = 'user-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS user_assets_insert_own ON storage.objects;
CREATE POLICY user_assets_insert_own ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS user_assets_delete_own ON storage.objects;
CREATE POLICY user_assets_delete_own ON storage.objects FOR DELETE
  USING (bucket_id = 'user-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
