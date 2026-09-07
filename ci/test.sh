#!/bin/sh
# Runs in a bun container on the Unraid worker. Touches nothing on Demi:
# this is the gate, not the deploy.
#
# The container build (docker-compose.prod.yml -> Dockerfile) runs its own
# `bun run build`, so the build here is not producing the artifact that ships.
# It is here to fail the push rather than the deploy: a type error should be
# red before anyone triggers a manual deploy, not discovered on the streaming
# box when overlays are wanted.
set -eu

cd repo
bun install --frozen-lockfile
bun run typecheck

# Lint GATES. The two categories that were failing on day one are recorded as
# warnings in eslint.config.js with their counts and the reason, so this stops
# anything NEW at error level while the known debt stays visible rather than
# hidden behind a blanket `|| true`.
bun run lint

bun test
bun run build
