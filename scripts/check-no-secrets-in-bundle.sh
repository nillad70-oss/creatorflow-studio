#!/usr/bin/env bash
# Fails if any server-only secret value appears in files served to browsers.
# Run after `next build` with sentinel values in the secret env vars.
set -euo pipefail
found=0
for v in SUPABASE_SERVICE_ROLE_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET ANTHROPIC_API_KEY INTENT_ENGINE_SERVICE_KEY; do
  val="${!v:-}"
  [ -z "$val" ] && continue
  if grep -rqF "$val" .next/static 2>/dev/null; then
    echo "LEAK: value of $v found in browser bundle"; found=1
  fi
done
[ "$found" -eq 0 ] && echo "OK: no server secrets in browser bundles"
exit "$found"
