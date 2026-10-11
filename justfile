set minimum-version := '1.55.0'
set lazy
set default-list
set shell := ["bash", "-euo", "pipefail", "-c"]

# Install, typecheck, lint, format check, tests and the production build, exactly as CI runs them.
[group('ci')]
check: _static _test _build

# Run the tests; arguments go to bun test.
[group('dev')]
test *args: (_test args)

[private]
_static:
    bun install --frozen-lockfile
    bun run typecheck
    bun run lint
    bun run format:check

[private]
_test *args:
    bun test {{ args }}

[private]
_build:
    bun run build
