#!/bin/sh
# Runs ON Demi, in the rsynced checkout at ~/ci/deploys/synthform.
#
# WHY THIS REFUSES TO RUN MID-STREAM. These are the overlays. Recreating the
# container swaps them out from under OBS, which is visible on the broadcast
# in a way a backend restart never is. synthfunc's deploy already refuses
# while a guest is live; this is the same guard aimed at Bryan's own stream.
#
# The signal comes from synthmult's `stream` channel rather than obs-websocket
# directly: its producer publishes the COMPLETE state ({obs, streaming}) on
# every edge into a single Redis slot, so one GET answers "is he live" without
# a WebSocket handshake from a shell script. Redis on Demi is localhost-only,
# which is exactly why this check has to run here rather than on the worker.
set -eu

REDIS=$(docker ps --filter label=com.docker.compose.project=synthmult \
                  --filter name=redis --format '{{.Names}}' | head -1)

if [ -z "$REDIS" ]; then
  echo "::warning:: synthmult's redis not found -- deploying without the live check."
else
  state=$(docker exec "$REDIS" redis-cli -n 0 GET "events:demi:stream:last" 2>/dev/null || true)
  case "$state" in
    *'"streaming": true'*|*'"streaming":true'*)
      echo "::error:: OBS is LIVE. Recreating overlays now would change them mid-broadcast."
      echo "           Deploy after the stream ends, or stop the stream first."
      exit 1
      ;;
    "")
      echo "::warning:: no stream state in redis -- deploying without the live check."
      ;;
    *)
      echo "ok: OBS not streaming; safe to recreate overlays."
      ;;
  esac
fi

# --force-recreate because a Vite build bakes VITE_* in at build time: without
# it Compose can keep a container whose bundle predates the rebuild.
docker compose -f docker-compose.prod.yml up --build --force-recreate -d --remove-orphans
docker image prune -f
