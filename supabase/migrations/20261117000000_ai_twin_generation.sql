-- ============================================================
-- NillaFlow AI Twin™ — Phase 2: image creation
-- Additive only. Safe to re-run. ROLLBACK at the bottom.
-- ============================================================

-- A creation = one request from the creator. The system runs several candidates
-- (rounds of generation_jobs) and delivers only images that pass the likeness
-- and safety checks. Credits are held up front and charged only on delivery.
CREATE TABLE IF NOT EXISTS public.twin_creations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  twin_id        UUID REFERENCES public.twin_profiles(id) ON DELETE CASCADE,
  consent_id     UUID REFERENCES public.consent_records(id) ON DELETE SET NULL,
  style          TEXT NOT NULL,
  mode           TEXT NOT NULL,
  quality_tier   TEXT NOT NULL,
  aspect_ratio   TEXT NOT NULL,
  user_prompt    TEXT,
  credits_held   INTEGER NOT NULL CHECK (credits_held >= 0),
  round          SMALLINT NOT NULL DEFAULT 1,
  status         TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed','blocked')),
  failure_reason TEXT,
  best_asset_id  UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS twin_creations_user ON public.twin_creations (user_id, created_at DESC);
ALTER TABLE public.twin_creations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS twin_creations_select_own ON public.twin_creations;
CREATE POLICY twin_creations_select_own ON public.twin_creations FOR SELECT USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.twin_creations FROM anon, authenticated;

-- One "creation" = one request from the creator, fanned out to several
-- variants (one generation_job each) across the best available models.
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS creation_id     UUID;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS engine          TEXT;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS style           TEXT;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS quality_tier    TEXT;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS aspect_ratio    TEXT;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS user_prompt     TEXT;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS consent_id      UUID REFERENCES public.consent_records(id) ON DELETE SET NULL;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS status_url      TEXT;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS response_url    TEXT;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS result_url      TEXT;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS claimed_at      TIMESTAMPTZ;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS round           SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS likeness        SMALLINT;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS check_result    JSONB;

-- Phase 2 statuses: queued -> running -> returned (provider finished) -> processing -> succeeded | failed | blocked
ALTER TABLE public.generation_jobs DROP CONSTRAINT IF EXISTS generation_jobs_status_check;
ALTER TABLE public.generation_jobs ADD CONSTRAINT generation_jobs_status_check
  CHECK (status IN ('queued','running','returned','processing','succeeded','failed','blocked','cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS generation_jobs_provider_job_once
  ON public.generation_jobs (provider, provider_job_id) WHERE provider_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS generation_jobs_creation ON public.generation_jobs (creation_id);
CREATE INDEX IF NOT EXISTS generation_jobs_user_day ON public.generation_jobs (user_id, created_at DESC);

ALTER TABLE public.generated_assets ADD COLUMN IF NOT EXISTS creation_id UUID;
ALTER TABLE public.generated_assets ADD COLUMN IF NOT EXISTS score       SMALLINT CHECK (score BETWEEN 0 AND 100);
ALTER TABLE public.generated_assets ADD COLUMN IF NOT EXISTS likeness    SMALLINT CHECK (likeness BETWEEN 0 AND 100);
ALTER TABLE public.generated_assets ADD COLUMN IF NOT EXISTS is_best     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.generated_assets ADD COLUMN IF NOT EXISTS width       INTEGER;
ALTER TABLE public.generated_assets ADD COLUMN IF NOT EXISTS height      INTEGER;
CREATE INDEX IF NOT EXISTS generated_assets_user ON public.generated_assets (user_id, created_at DESC);

-- generated-media accepts PNG output from both engines (already allowed); nothing to change.

-- ============================================================
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.twin_creations;
--   ALTER TABLE public.generated_assets DROP COLUMN IF EXISTS creation_id, DROP COLUMN IF EXISTS score,
--     DROP COLUMN IF EXISTS is_best, DROP COLUMN IF EXISTS width, DROP COLUMN IF EXISTS height;
--   ALTER TABLE public.generation_jobs DROP COLUMN IF EXISTS creation_id, DROP COLUMN IF EXISTS engine,
--     DROP COLUMN IF EXISTS style, DROP COLUMN IF EXISTS quality_tier, DROP COLUMN IF EXISTS aspect_ratio,
--     DROP COLUMN IF EXISTS user_prompt, DROP COLUMN IF EXISTS consent_id, DROP COLUMN IF EXISTS status_url,
--     DROP COLUMN IF EXISTS response_url, DROP COLUMN IF EXISTS result_url, DROP COLUMN IF EXISTS claimed_at;
--   (then restore the Phase 1 status CHECK)
-- ============================================================
