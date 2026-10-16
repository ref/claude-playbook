---
name: playbook-update
description: Sync this repository against the current claude-playbook: read the lock, fetch the playbook, diff its templates against the installed files, show the differences, write on a yes and bump the lock. Use when asked to update, sync or check the playbook.
---

You are syncing this repository against the claude-playbook it was adopted from. The sync
touches protected paths (workflows, `.githooks`, `.agents`, `AGENTS.md`, `CLAUDE.md`,
`.claude/settings.json`): run it only when the human asks for it, and expect them to review
the PR with particular care.

**Rule 0 of the playbook's ADOPT document holds here too**: never overwrite a file without
showing its exact diff and getting a yes, one file at a time.

## 1. Read the lock

    cat .agents/playbook.lock

Lines: `commit <sha>` (the playbook commit last synced to), `synced <date>`,
`source <git url>` (where the playbook was cloned from), and optional `docs <file> <words>`
baselines written by `playbook-compact`. No lock: the repository was not adopted; stop and
say so.

## 2. Fetch the playbook

    git clone --depth 1 <source> <tmpdir>

A fresh clone every time, never a stale copy. Delete the temporary directory when done.

## 3. Fast path

If `git -C <tmpdir> rev-parse HEAD` equals the lock's `commit`: report `up to date at <sha>`,
give the doc-size report (step 6), write nothing, stop.

## 4. The delta

    git -C <tmpdir> fetch --unshallow
    git -C <tmpdir> log --oneline --name-only <lock commit>..HEAD

Report this first: which template files moved and why (the commit messages). If the lock's
commit is not in the history, say so and run the full comparison anyway.

## 5. Compare and sync

The mapping from template to installed path is the install table in the playbook's ADOPT
document (`ADOPT.md` in the clone's `docs` directory; read it there); the only value rendered is `{{DEFAULT_BRANCH}}`
(`gh api repos/{owner}/{repo} --jq .default_branch`). For every template file, render it and
compare it with the installed file. Two classes:

- **Owned by the project, report only**: `AGENTS.md`, `docs/RUNBOOK.md` and
  `.github/workflows/ci.yml` (they grow with the repository, and `ci.yml` has its steps
  trimmed to the project's scripts), `.claude/settings.json` (merged, never replaced),
  `.github/dependabot.yml` (it may carry extra ecosystems). If the template holds an
  improvement the project would want, name it to the human and stop: never apply it, never
  fold it into the sync PR. The one exception is prose that describes the installed machinery
  falsely: show the exact replacement and apply it on a yes.
- **Kept identical to the playbook**: everything else adoption installed: the skills, the
  three script modules with their tests, the other workflows, the PR template, the pre-push
  hook, the worker brief and routing files. Compare byte for byte; a difference is drift to
  sync. Show the diff, write on the human's yes.

Also report: template files that are new upstream and not installed (offer to install),
and installed files whose template was removed upstream (offer to delete). A removed
file is shown and confirmed, never deleted silently.

## 6. The doc-size report (every run, the fast path included)

`wc -w` over `CLAUDE.md`, `AGENTS.md`, any file they `@`-include, and `docs/RUNBOOK.md`.
Where the lock carries `docs` baselines, report growth since the last compaction. Noticeable
growth: suggest `/playbook-compact`. A signal, never a gate.

## 7. Land it

One branch, one PR, `chore: sync playbook files`, with the lock rewritten in the same PR:

    commit <new playbook HEAD sha>
    synced <YYYY-MM-DD>
    source <git url>

Keep the existing `docs` lines. The PR body lists, per file, what changed and why (the
upstream commit messages). The PR touches the gates, so the human reviews it with
particular care.
