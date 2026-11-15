-- ============================================================
-- NillaFlow Studio™ — lock down SECURITY DEFINER functions
-- Found by the Supabase security advisor after the Phase 0 release.
--
-- Before: anyone (even signed out) could call, via /rest/v1/rpc/...
--   get_current_story(any user id)          -> read any creator's story
--   set_current_story(any user, any story)  -> switch any creator's story
--   check_usage_limit / handle_new_user      -> callable, not meant to be
--
-- After:
--   * set_current_story: still callable by signed-in users (my-story and
--     build-story pages use it) but ONLY for their own user id.
--   * get_current_story: server-only (lib/storyContext.js uses the service
--     role); also refuses other users' ids if ever called with a session.
--   * check_usage_limit, handle_new_user: not callable through the API.
--     (handle_new_user still runs as the signup trigger.)
--   * search_path pinned on all public functions (advisor warning 0011).
-- Function bodies are otherwise unchanged. Safe to re-run.
-- ROLLBACK at the bottom.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_current_story(p_user_id uuid, p_story_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE public.story_profiles
  SET is_current = FALSE
  WHERE user_id = p_user_id AND is_current = TRUE;

  UPDATE public.story_profiles
  SET is_current = TRUE
  WHERE id = p_story_id AND user_id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_story(p_user_id uuid)
 RETURNS TABLE(id uuid, goal_type text, voice_track text, story_beats jsonb, compliance_flags jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT sp.id, sp.goal_type, sp.voice_track, sp.story_beats, sp.compliance_flags
  FROM public.story_profiles sp
  WHERE sp.user_id = p_user_id AND sp.is_current = TRUE
  LIMIT 1;
END;
$function$;

ALTER FUNCTION public.check_usage_limit(uuid, text) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.protect_billing_columns() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_current_story(uuid)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_current_story(uuid, uuid)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_current_story(uuid, uuid)  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_usage_limit(uuid, text)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()              FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_current_story(uuid)        TO service_role;
GRANT  EXECUTE ON FUNCTION public.check_usage_limit(uuid, text)  TO service_role;

-- ============================================================
-- ROLLBACK:
--   GRANT EXECUTE ON FUNCTION public.get_current_story(uuid) TO PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.set_current_story(uuid, uuid) TO PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.check_usage_limit(uuid, text) TO PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated;
--   (then re-run the baseline definitions of get/set_current_story to drop the guard)
-- ============================================================
