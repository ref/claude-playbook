#!/bin/bash
# Setup script for the Claude cloud environment `<repo>`, which workers and the reviewer
# share. Paste it into the environment's setup-script field (section 6 of the playbook's SETUP page) and
# adapt the lines marked ADAPT to the project. It runs once as root, in /home/user, and the
# result is cached. It must finish in under five minutes, or the environment is not cached
# and every session pays for it again. A setup script that exits non-zero stops the session
# from starting, so this one never does: every step ends in `|| true` and the log is the
# place to look (/tmp/setup.log, read it in a session when something is missing).
exec >> /tmp/setup.log 2>&1
set -x

# Git identity for commits made in the cloud. Without it the VM commits as its default user
# "Claude", and GitHub then adds "Co-authored-by: Claude <noreply@anthropic.com>" to every
# squash merge: an AI attribution the playbook forbids.
# ADAPT: your GitHub name and your GitHub noreply (<id>+<login>@users.noreply.github.com)
# or public email; never a placeholder left in.
git config --global user.name "<your GitHub name>" || true
git config --global user.email "<your GitHub noreply or public email>" || true

# The repository is cloned to /home/user/<repo-name>, but the script starts in /home/user.
# ADAPT: the repository's name (keep the quotes).
cd "/home/user/<repo>" || true

# Node: the VM ships an older major than the project's engines.node may require. `n` installs
# to /usr/local/bin; the symlinks make that copy win whatever the PATH order is.
# ADAPT: the major from package.json "engines.node", for example 24.
npm install -g n || true
n "<node-major>" || true
for tool in node npm; do
  found="$(command -v "$tool")"
  if [ -n "$found" ] && [ "$found" != "/usr/local/bin/$tool" ]; then
    ln -sf "/usr/local/bin/$tool" "$found" || true
  fi
done
node -v || true

# pnpm: the exact version from package.json "packageManager", through npm (corepack's
# download fails in the cloud).
# ADAPT: the version, for example 10.4.1.
npm install -g "pnpm@<pnpm-version>" || true
pnpm -v || true
pnpm install --frozen-lockfile || true

# PostgreSQL 16 is pre-installed but not running, and there is no Docker daemon, so
# `docker compose` cannot start a database. The cache keeps files and data directories but
# not running processes: the role, the database and the schema made here persist, and the
# server itself is started again in every session by the SessionStart hook
# (.agents/cloud-session-start.sh).
service postgresql start || true
for _ in $(seq 1 30); do
  pg_isready -q && break
  sleep 1
done

# The role and database that the project's DATABASE_URL names, created only when missing.
# ADAPT: role, password and database; the test database name must contain "test"
# (AGENTS.md "Shared mutable state").
su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='app'\" | grep -q 1 || psql -c \"CREATE ROLE app LOGIN SUPERUSER PASSWORD 'app'\"" || true
su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='app_test'\" | grep -q 1 || psql -c \"CREATE DATABASE app_test OWNER app\"" || true

# The project's test-database setup (migrations, seed), with the URL given inline: the
# variables set in the environment dialog are not guaranteed to be visible to this script.
# ADAPT: the project's script name.
DATABASE_URL="postgres://app:app@localhost:5432/app_test" pnpm run db:test:setup || true

exit 0
