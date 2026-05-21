-- ============================================================
-- CREATORFLOW STUDIO™ — Supabase Database Setup
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- ── 1. Users Profile Table ──
-- Extends Supabase auth.users with creator profile data
CREATE TABLE IF NOT EXISTS public.users (
  id                    UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email                 TEXT NOT NULL,
  -- Creator profile (set during onboarding)
  niche                 TEXT,
  audience              TEXT,
  content_goals         TEXT,
  tone                  TEXT,
  creator_level         TEXT DEFAULT 'beginner',
  preferred_platform    TEXT DEFAULT 'instagram',
  content_category      TEXT,
  -- Subscription
  subscription_tier     TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  stripe_customer_id    TEXT UNIQUE,
  stripe_subscription_id TEXT,
  trial_ends_at         TIMESTAMPTZ,
  -- Onboarding
  onboarding_complete   BOOLEAN DEFAULT FALSE,
  -- Meta
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Scripts Table ──
CREATE TABLE IF NOT EXISTS public.scripts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
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

-- ── 3. Content Calendar Table ──
CREATE TABLE IF NOT EXISTS public.content_calendar (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  topic        TEXT NOT NULL,
  hook         TEXT,
  category     TEXT,
  platform     TEXT,
  content_type TEXT,
  publish_date DATE,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Captions Table ──
CREATE TABLE IF NOT EXISTS public.captions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  script_id      UUID REFERENCES public.scripts(id) ON DELETE SET NULL,
  subtitle_text  TEXT,
  export_format  TEXT DEFAULT 'plain',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Usage Tracking (for free tier limits) ──
CREATE TABLE IF NOT EXISTS public.usage (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  month           TEXT NOT NULL, -- 'YYYY-MM'
  scripts_count   INTEGER DEFAULT 0,
  ideas_count     INTEGER DEFAULT 0,
  captions_count  INTEGER DEFAULT 0,
  UNIQUE(user_id, month)
);

-- ============================================================
-- ROW LEVEL SECURITY (CRITICAL — keeps user data private)
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "scripts_all_own" ON public.scripts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "calendar_all_own" ON public.content_calendar FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "captions_all_own" ON public.captions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "usage_all_own" ON public.usage FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER scripts_updated_at
  BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- (Runs when a new user signs up via Supabase Auth)
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- USAGE LIMIT HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION check_usage_limit(
  p_user_id UUID,
  p_type TEXT -- 'scripts', 'ideas', 'captions'
) RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
