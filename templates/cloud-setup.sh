#!/usr/bin/env bash
# Setup script for the Claude cloud environments `<repo>-worker` and `<repo>-reviewer`.
# Copy it into the environment's setup-script field and adapt it to the project. It must
# finish in under five minutes, or the environment is not cached and every session pays for
# it again.
set -euo pipefail

# The package manager comes from package.json "packageManager".
corepack enable
pnpm install --frozen-lockfile

# Services the tests need (a database), when the project has a compose file and the
# environment has docker. A suite that needs a service skips without it; CI owns it.
if command -v docker >/dev/null 2>&1; then
  for compose in compose.yaml compose.yml docker-compose.yaml docker-compose.yml; do
    if [ -f "$compose" ]; then
      docker compose -f "$compose" up -d --wait
      break
    fi
  done
fi

# The test database URL: its name must contain "test" (see AGENTS.md "Shared mutable
# state"). Adjust the value to the project's compose service.
echo 'export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/app_test}"' >> "$HOME/.bashrc"
