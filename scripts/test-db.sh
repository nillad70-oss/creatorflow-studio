#!/usr/bin/env bash
# Applies the migrations to a throwaway Postgres and runs the database tests.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres ./scripts/test-db.sh
set -euo pipefail
DB=nf_test_$$
psql -v ON_ERROR_STOP=1 -q -c "create database $DB"
trap 'psql -q -c "drop database if exists $DB" >/dev/null' EXIT
run() { psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1" 2>&1 | grep -E "PASS|FAIL|ERROR" || true; }
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/supabase_stubs.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f" >/dev/null 2>&1 || { echo "FAIL applying $f"; exit 1; }; done
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f" >/dev/null 2>&1 || { echo "FAIL re-running $f (not idempotent)"; exit 1; }; done
echo "migrations apply cleanly and are idempotent"
out=$(psql -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/phase0_billing_integrity.test.sql 2>&1) || { echo "$out"; exit 1; }
echo "$out" | grep -oE "(PASS|FAIL)[^\"]*"
