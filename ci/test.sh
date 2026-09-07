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

# LINT RUNS BUT DOES NOT GATE — deliberately, and this should not be permanent.
#
# synthform has 29 pre-existing eslint errors (mostly no-explicit-any, plus an
# empty-interface). They predate this pipeline: the retired GHA workflow only
# deployed and never linted, so `eslint .` has never actually been enforced on
# this repo. Gating on it today would make synthform red from its first build
# and block the deploy path this pipeline exists to provide, for debt that has
# nothing to do with the change being pushed.
#
# The output is still printed on every run, so the count is visible rather than
# forgotten. Flip the `|| true` once the existing errors are cleared — a check
# nobody is forced to pass is a declaration, not a gate, and this is currently
# a declaration.
bun run lint || echo "::warning:: lint has pre-existing failures; not gating (see ci/test.sh)"

bun test
bun run build
