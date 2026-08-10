-- ============================================================
-- NillaFlow Studio™ — Phase 2: Conversational Refinement Migration
-- Purely additive: two new tables, no existing table touched.
-- Run in Supabase SQL Editor AFTER all prior migrations.
-- ============================================================

-- ── Creative Sessions ──
-- One row per generation session. Stores the original request context so
-- refinement calls can rebuild the same story/asset context without the
-- frontend having to re-send everything on every follow-up message.
CREATE TABLE IF NOT EXISTS public.creative_sessions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  session_type      TEXT CHECK (session_type IN ('adcopy')) DEFAULT 'adcopy',
  context_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { topic, niche, audience, platform, objective, offer_types,
  --   audience_problems, cta_objectives, story_objective, asset_ids,
  --   asset_story_note }
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_sessions_user ON public.creative_sessions (user_id);

ALTER TABLE public.creative_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creative_sessions_all_own" ON public.creative_sessions
  FOR ALL USING (auth.uid() = user_id);

-- ── Session Messages ──
-- The ordered conversation history within a session. Assistant messages
-- store the full structured ad copy result as JSON text so the frontend
-- can replace its displayed result directly from the latest message.
CREATE TABLE IF NOT EXISTS public.session_messages (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    UUID REFERENCES public.creative_sessions(id) ON DELETE CASCADE NOT NULL,
  role          TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_messages_session ON public.session_messages (session_id, created_at);

ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

-- Access is scoped through the parent session's ownership, since
-- session_messages has no direct user_id column.
CREATE POLICY "session_messages_all_via_session" ON public.session_messages
  FOR ALL USING (
    session_id IN (SELECT id FROM public.creative_sessions WHERE user_id = auth.uid())
  );

CREATE TRIGGER creative_sessions_updated_at
  BEFORE UPDATE ON public.creative_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
