#!/usr/bin/env bash
set -euo pipefail
image="${1:-bitcoin-monitor:ci}"
name="bitcoin-runtime-$$"
volume="$name-data"
cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker volume create "$volume" >/dev/null
docker image inspect "$image" --format '{{json .Config}}' > /tmp/bitcoin-image-$$.json
node -e '
const assert = require("node:assert/strict");
const fs = require("node:fs");
const config = JSON.parse(fs.readFileSync(process.argv[1]));
assert.equal(config.User, "node");
assert.deepEqual(config.Entrypoint, ["dumb-init", "--"]);
assert.deepEqual(config.Cmd, ["node", "index.js"]);
assert.deepEqual(JSON.parse(config.Labels["io.gladysassistant.manifest"]), JSON.parse(fs.readFileSync("gladys-assistant-integration.json")));
' /tmp/bitcoin-image-$$.json
rm /tmp/bitcoin-image-$$.json
# Run the same fixtures with the production dependencies and musl runtime.
docker run --rm --network none --read-only --tmpfs /tmp:rw,nosuid,size=64m -v "$PWD/test:/app/test:ro" "$image" node --test
for signal in SIGTERM SIGINT; do
  docker run -d --name "$name" --network none --read-only \
    -v "$volume:/data" -v "$PWD/scripts:/app/scripts:ro" \
    "$image" node scripts/docker-lifecycle.js >/dev/null
  ready=false
  for attempt in $(seq 1 60); do
    if docker exec "$name" test -f /data/ready; then ready=true; break; fi
    sleep 1
  done
  test "$ready" = true
  docker kill --signal "$signal" "$name" >/dev/null
  timeout 30 docker wait "$name" | grep -x 0
  docker logs "$name" | grep "Received $signal"
  docker rm "$name" >/dev/null
  docker run --rm --network none --read-only -v "$volume:/data" \
    -v "$PWD/scripts:/app/scripts:ro" "$image" node scripts/docker-lifecycle.js read
  docker run --rm --network none -v "$volume:/data" "$image" node -e 'require("node:fs").unlinkSync("/data/ready")'
done
# A valid but different manifest must be rejected by the build guard.
if docker build --build-arg 'GLADYS_INTEGRATION_MANIFEST={}' . > /tmp/bitcoin-negative-$$.log 2>&1; then
  echo 'Unexpected success with a mismatched manifest' >&2
  exit 1
fi
grep 'The embedded Gladys manifest does not match' /tmp/bitcoin-negative-$$.log
rm /tmp/bitcoin-negative-$$.log
