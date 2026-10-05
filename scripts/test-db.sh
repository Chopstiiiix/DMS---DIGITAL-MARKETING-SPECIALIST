#!/usr/bin/env bash
# Applies the migrations to a scratch database on a local Postgres and runs the
# row level security tests. Needs psql and a Postgres you can create databases on.
#
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./scripts/test-db.sh
set -euo pipefail

cd "$(dirname "$0")/.."
DB="dms_test_$$"

psql -q -d postgres -c "create database \"$DB\""
trap 'psql -q -d postgres -c "drop database if exists \"$DB\" with (force)"' EXIT

run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }

run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/tests/10_rls.sql
