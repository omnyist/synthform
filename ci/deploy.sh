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

# .env MUST exist here, and its absence is a STOP rather than a default.
#
# Learned the hard way on this pipeline's first real deploy, 2026-09-06. The
# deploy directory is new (~/ci/deploys/synthform); Demi's working .env lived
# in the old hand-managed checkout at ~/Code/synthform. The rsync's
# `--exclude .env` did exactly what it promised — it did not overwrite a file
# that was never here — and the build went ahead with NO VITE_* set at all.
#
# The failure is invisible from outside: Vite bakes VITE_* at BUILD time, so
# the container starts, nginx serves, and /omnibar returns 200. The overlays
# just quietly point at defaults instead of saya:7175/7176, with no tenant and
# no token. A health check cannot see it. So the check belongs here.
#
# Seeding it is a one-time manual step, deliberately: this file is not in git
# (it holds VITE_GITHUB_TOKEN) and the pipeline does not reconstruct it,
# because origin/main reads four variables the working .env does not define.
if [ ! -f .env ]; then
  echo "::error:: no .env in $(pwd)."
  echo "           Vite bakes VITE_* at build time, so deploying without it"
  echo "           yields overlays that load and point at nothing."
  echo "           Seed it once, then this deploy preserves it:"
  echo "             cp ~/Code/synthform/.env ~/ci/deploys/synthform/.env"
  exit 1
fi

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
