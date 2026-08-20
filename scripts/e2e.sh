#!/bin/sh
# Runs the Playwright suite against a throwaway stack: the production image, a
# scratch Postgres, and the deterministic AI stub in tests/aistub.
#
# Everything runs in containers, so no Node.js is needed on the host -- only
# Docker. Browsers are cached in a named volume, so the first run downloads
# Chromium and later runs reuse it.
set -e

PROJECT=fundsflow-e2e
COMPOSE="docker compose -p $PROJECT -f docker-compose.test.yml"
NETWORK="${PROJECT}_default"
BROWSER_CACHE="${PROJECT}-browsers"

cleanup() {
  echo "--- tearing down ---"
  $COMPOSE down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "--- building and starting the stack ---"
$COMPOSE up -d --build

echo "--- waiting for the app (through the TLS proxy) ---"
ready=0
i=1
while [ "$i" -le 90 ]; do
  # Probe from a sibling container: Caddy serves the "proxy" hostname, so the
  # request has to arrive with that SNI, not via localhost.
  if $COMPOSE exec -T aistub wget -q --no-check-certificate -O /dev/null \
    https://proxy/api/health >/dev/null 2>&1; then
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "app never became healthy; logs follow:"
  $COMPOSE logs app | tail -40
  exit 1
fi

echo "--- running playwright ---"
docker run --rm \
  --network "$NETWORK" \
  -v "$PWD":/work -w /work \
  -v "$BROWSER_CACHE":/ms-playwright \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  -e E2E_BASE_URL=https://proxy \
  -e E2E_AISTUB_URL=http://aistub:8080 \
  -e CI=1 \
  node:22-bookworm \
  sh -lc 'npm ci --no-audit --no-fund >/dev/null 2>&1 && npx playwright install --with-deps chromium >/dev/null 2>&1 && npx playwright test "$@"' -- "$@"
