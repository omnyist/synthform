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

# The pinned just comes from the standards input the pipeline mounts beside
# repo. On this Alpine image the installer adds curl and bash first.
sh standards/ci/install-just.sh

cd repo
just --list >/dev/null

# The gate is in the justfile: install, typecheck, lint, format:check, test and
# build. Lint GATES: the rules that had findings when they were turned on are
# recorded as warnings in .oxlintrc.json with their counts and the reason, so
# this stops anything NEW at error level while the known debt stays visible
# rather than hidden behind a blanket `|| true`.
just check
