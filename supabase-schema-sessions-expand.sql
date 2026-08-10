-- ============================================================
-- NillaFlow Studio™ — Expand creative_sessions to Scripts + Captions
-- Purely a constraint update - no data loss, no table recreation.
-- Run AFTER supabase-schema-sessions.sql.
-- ============================================================

ALTER TABLE public.creative_sessions
  DROP CONSTRAINT IF EXISTS creative_sessions_session_type_check;

ALTER TABLE public.creative_sessions
  ADD CONSTRAINT creative_sessions_session_type_check
  CHECK (session_type IN ('adcopy', 'script', 'captions'));
