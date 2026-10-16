#!/usr/bin/env bash
# Setup script for the Claude cloud environment `<repo>`, which workers and the reviewer
# share. Copy it into the environment's setup-script field and adapt it to the project. It
# must finish in under five minutes, or the environment is not cached and every session pays
# for it again.
set -euo pipefail

# The package manager comes from package.json "packageManager".
corepack enable
pnpm install --frozen-lockfile

# Services the tests need (a database), when the project has a compose file and the
# environment has docker. This script must provide the service AND the variables the suite
# reads (below): a suite whose database is missing fails here, it does not skip. Wait for the
# service to accept connections (a health check on the compose service, or a pg_isready
# loop) before the script ends.
if command -v docker >/dev/null 2>&1; then
  for compose in compose.yaml compose.yml docker-compose.yaml docker-compose.yml; do
    if [ -f "$compose" ]; then
      docker compose -f "$compose" up -d --wait
      break
    fi
  done
fi

# The test database URL, and every other variable the build and the tests need (there is no
# `.env.local` in the cloud: `.worktreeinclude` applies to desktop worktrees only). The test
# database name must contain "test" (see AGENTS.md "Shared mutable state"). Adjust the
# values to the project's compose service.
echo 'export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/app_test}"' >> "$HOME/.bashrc"
