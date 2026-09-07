#!/bin/sh
# Runs ON Demi after deploy.sh. Overlays are only real if a browser source
# can load one, so check the route OBS actually renders rather than the
# container's status field: a container can be Up and serving 502s.
set -u

for i in $(seq 1 20); do
  sleep 3
  code=$(curl -s -o /dev/null -m 5 -w '%{http_code}' http://localhost:8008/omnibar || echo 000)
  if [ "$code" = "200" ]; then
    echo "ok: /omnibar returned 200 after $((i * 3))s"
    exit 0
  fi
done

echo "FAILED: /omnibar never returned 200 (last: ${code:-none})"
echo "--- last 30 log lines ---"
docker logs --tail 30 synthform-overlays-1 2>&1 || true
exit 1
