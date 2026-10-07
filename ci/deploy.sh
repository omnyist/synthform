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
# the container starts, the preview server serves, and /omnibar returns
# 200. Without a token the activity feed is just empty. A health check
# cannot see it. So the check belongs here.
#
# The pipeline's deploy task writes this file from the Synthform 1Password
# Environment before it runs this script (ci/tasks/deploy.yml); run by hand,
# the same file has to be there first.
if ! grep -q '^VITE_GITHUB_TOKEN=[^[:space:]]' .env 2>/dev/null; then
  echo "::error:: no VITE_GITHUB_TOKEN in $(pwd)/.env."
  echo "           Vite bakes VITE_* at build time, so building without it"
  echo "           ships overlays with an empty activity feed."
  echo "           The pipeline's deploy task writes it; check that task's log."
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
