#!/bin/sh
# Developer integration check; all browser/database state belongs to this test run.
set -eu
cd "$(dirname "$0")/.."
set -a
. ./.env
set +a
export WORKBENCH_DATABASE_PORT=55432
export WORKBENCH_DATABASE_URL=jdbc:postgresql://127.0.0.1:55432/campaign_workbench
backend_pid=
cleanup() {
  if [ -n "$backend_pid" ]; then kill "$backend_pid" 2>/dev/null || true; wait "$backend_pid" 2>/dev/null || true; fi
  docker compose -p campaign-workbench-smoke down
}
trap cleanup EXIT HUP INT TERM
docker compose -p campaign-workbench-smoke up -d --wait database
(cd backend && ./gradlew test bootJar)
java -jar backend/build/libs/campaign-workbench-0.0.1-SNAPSHOT.jar --server.port=18080 > backend/build/smoke-backend.log 2>&1 &
backend_pid=$!
attempt=0
until curl -fsS http://127.0.0.1:18080/api/status > /dev/null 2>&1; do
  attempt=$((attempt+1))
  if ! kill -0 "$backend_pid" 2>/dev/null || [ "$attempt" -ge 60 ]; then
    cat backend/build/smoke-backend.log
    exit 1
  fi
  sleep 1
done
curl -fsS http://127.0.0.1:18080/v3/api-docs -o backend/build/openapi.json
(cd backend && ./gradlew generateFrontendClient -PopenapiInput=build/openapi.json)
(cd frontend && npm run check:versions && npm test && npm run build && npm run test:e2e)
before=$(docker compose -p campaign-workbench-smoke exec -T database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select created_at from workbench_setup.installation where id = 1"')
docker compose -p campaign-workbench-smoke restart database
docker compose -p campaign-workbench-smoke up -d --wait database
after=$(docker compose -p campaign-workbench-smoke exec -T database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select created_at from workbench_setup.installation where id = 1"')
test -n "$before"
test "$before" = "$after"
echo "Setup checks passed; PostgreSQL installation state survived restart."
