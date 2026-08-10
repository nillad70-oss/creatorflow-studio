-- ============================================================
-- NillaFlow Studio™ — Asset Intelligence (Phase 1: Images) Migration
-- Purely additive: creates one new table and one new Storage bucket.
-- Does not alter, drop, or touch any existing table or column.
-- Run in Supabase SQL Editor AFTER all prior migrations.
-- ============================================================

-- ── Assets table ──
CREATE TABLE IF NOT EXISTS public.assets (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  storage_path    TEXT NOT NULL,        -- path inside the 'user-assets' bucket
  asset_type      TEXT CHECK (asset_type IN ('image', 'screenshot', 'product_image', 'brand_graphic')) DEFAULT 'image',
  mime_type       TEXT NOT NULL,        -- 'image/jpeg' | 'image/png' | 'image/webp'
  file_size_bytes INTEGER NOT NULL,
  ai_analysis     JSONB,                -- cached Claude vision analysis - NULL until first analyzed
  analyzed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_user ON public.assets (user_id);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_all_own" ON public.assets
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
-- Creates the bucket if it doesn't already exist. Private bucket -
-- files are only accessible via signed URLs or the owning user's
-- authenticated session, never publicly listable.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-assets',
  'user-assets',
  false,
  5242880, -- 5 MB in bytes, enforced at the storage layer as a second check
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: files live at path {user_id}/{filename} - a user can only
-- read/write/delete inside their own folder, enforced by matching the
-- first path segment against their own auth.uid().

CREATE POLICY "user_assets_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'user-assets' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user_assets_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-assets' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user_assets_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'user-assets' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- UPDATED_AT TRIGGER (reuses existing function, no redefinition needed)
-- ============================================================
-- assets table has no updated_at column by design - it's immutable once
-- uploaded except for ai_analysis, which is set once and cached, not edited.
