-- ============================================================
-- NillaFlow AI Twin™ — Phase 1: identity, consent & credit foundation
-- Additive only. No existing table is altered. Safe to re-run.
--
-- Access model (same as Phase 0):
--   * Browser sessions may READ their own rows. They never write these
--     tables directly: every write goes through a verified server route
--     (service role), so consent, credits and deletion can't be forged.
--   * Storage bucket twin-references has NO client policies: uploads and
--     downloads only happen through short-lived server-issued signed URLs.
-- ROLLBACK at the bottom.
-- ============================================================

-- ── Twin profile: one per creator (Phase 1) ──
CREATE TABLE IF NOT EXISTS public.twin_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'consented', 'ready', 'revoked')),
  display_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT twin_profiles_one_per_user UNIQUE (user_id)
);

-- ── Consent: versioned, scoped, with an on-camera recording as proof ──
CREATE TABLE IF NOT EXISTS public.consent_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  twin_id          UUID NOT NULL REFERENCES public.twin_profiles(id) ON DELETE CASCADE,
  consent_version  TEXT NOT NULL,
  scopes           TEXT[] NOT NULL CHECK (scopes <@ ARRAY['professional','fashion_lifestyle','video','voice']::text[] AND cardinality(scopes) > 0),
  attest_self      BOOLEAN NOT NULL CHECK (attest_self),
  attest_adult     BOOLEAN NOT NULL CHECK (attest_adult),
  recording_path   TEXT,
  ip_address       TEXT,
  user_agent       TEXT,
  signed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at       TIMESTAMPTZ
);

-- ── Reference photos (metadata; files live in the private bucket) ──
CREATE TABLE IF NOT EXISTS public.twin_reference_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  twin_id         UUID NOT NULL REFERENCES public.twin_profiles(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL UNIQUE,
  mime_type       TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),
  screening       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Generation jobs + outputs (schema now, used from Phase 2) ──
CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  twin_id          UUID REFERENCES public.twin_profiles(id) ON DELETE SET NULL,
  job_type         TEXT NOT NULL CHECK (job_type IN ('image','video','voice')),
  provider         TEXT,
  provider_job_id  TEXT,
  prompt           TEXT,
  status           TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  credits_charged  INTEGER NOT NULL DEFAULT 0 CHECK (credits_charged >= 0),
  cost_usd         NUMERIC(10,4),
  error            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.generated_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  twin_id         UUID REFERENCES public.twin_profiles(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES public.generation_jobs(id) ON DELETE SET NULL,
  storage_path    TEXT NOT NULL UNIQUE,
  media_type      TEXT NOT NULL CHECK (media_type IN ('image','video','audio')),
  ai_disclosure   BOOLEAN NOT NULL DEFAULT TRUE,
  provenance      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Credits: balance row + append-only ledger, changed only via apply_credit_entry() ──
CREATE TABLE IF NOT EXISTS public.credit_accounts (
  user_id    UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  balance    INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entry_type    TEXT NOT NULL CHECK (entry_type IN ('grant','purchase','hold','charge','refund','release','adjustment')),
  delta         INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  reference     TEXT,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
-- One ledger entry per external reference + type (e.g. a Stripe session can only grant once).
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_reference_once
  ON public.credit_ledger (entry_type, reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS credit_ledger_user ON public.credit_ledger (user_id, created_at DESC);

-- Atomic balance change. Refuses to go below zero. Returns the new balance,
-- or NULL if the change would overdraw or the reference was already used.
CREATE OR REPLACE FUNCTION public.apply_credit_entry(
  p_user_id uuid, p_delta integer, p_entry_type text, p_reference text DEFAULT NULL, p_note text DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_balance integer;
BEGIN
  IF p_reference IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.credit_ledger WHERE entry_type = p_entry_type AND reference = p_reference) THEN
    RETURN NULL; -- already applied (idempotent webhook retries)
  END IF;

  INSERT INTO public.credit_accounts (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.credit_accounts
     SET balance = balance + p_delta, updated_at = NOW()
   WHERE user_id = p_user_id AND balance + p_delta >= 0
  RETURNING balance INTO v_balance;

  IF v_balance IS NULL THEN
    RETURN NULL; -- would overdraw
  END IF;

  INSERT INTO public.credit_ledger (user_id, entry_type, delta, balance_after, reference, note)
  VALUES (p_user_id, p_entry_type, p_delta, v_balance, p_reference, p_note);

  RETURN v_balance;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.apply_credit_entry(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_credit_entry(uuid, integer, text, text, text) TO service_role;

-- ── Deletion receipts + audit trail ──
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scope           TEXT NOT NULL DEFAULT 'ai_twin',
  files_removed   INTEGER NOT NULL DEFAULT 0,
  rows_removed    JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','partial','failed')),
  requested_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target      TEXT,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_log_user ON public.audit_log (user_id, created_at DESC);

-- ── Row Level Security: read own rows only; no client writes ──
ALTER TABLE public.twin_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twin_reference_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_assets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log             ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['twin_profiles','consent_records','twin_reference_images','generation_jobs',
                           'generated_assets','credit_accounts','credit_ledger','deletion_requests']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (auth.uid() = user_id)', t || '_select_own', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
-- audit_log: server-only (no client policy at all).
REVOKE ALL ON public.audit_log FROM anon, authenticated;

-- updated_at triggers
DROP TRIGGER IF EXISTS twin_profiles_updated_at ON public.twin_profiles;
CREATE TRIGGER twin_profiles_updated_at BEFORE UPDATE ON public.twin_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Storage buckets (private; no client policies) ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('twin-references', 'twin-references', false, 26214400,
        ARRAY['image/jpeg','image/png','image/webp','video/webm','video/mp4','video/quicktime'])
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('generated-media', 'generated-media', false, 104857600,
        ARRAY['image/jpeg','image/png','image/webp','video/mp4','audio/mpeg'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ROLLBACK (drops AI Twin data; take a copy first):
--   DROP TABLE IF EXISTS public.generated_assets, public.generation_jobs,
--     public.twin_reference_images, public.consent_records, public.twin_profiles,
--     public.credit_ledger, public.credit_accounts, public.deletion_requests,
--     public.audit_log CASCADE;
--   DROP FUNCTION IF EXISTS public.apply_credit_entry(uuid, integer, text, text, text);
--   -- buckets: empty them in the dashboard, then delete 'twin-references' and 'generated-media'.
-- ============================================================
