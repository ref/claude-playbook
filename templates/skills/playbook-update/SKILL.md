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
still run step 5's diff of the project-owned files against the current templates (the lock
can say `up to date` while a hunk never reached them), give the doc-size report (step 6),
write nothing the human did not say yes to, stop.

## 4. The delta

    git -C <tmpdir> fetch --unshallow
    git -C <tmpdir> log --oneline --name-only <lock commit>..HEAD

Report this first: which template files moved and why (the commit messages). If the lock's
commit is not in the history, say so and run the full comparison anyway.

## 5. Compare and sync

The mapping from template to installed path is the install table in the playbook's ADOPT
document (`ADOPT.md` in the clone's `docs` directory; read it there); the only value rendered
is the default branch name (`gh api repos/{owner}/{repo} --jq .default_branch`), which
replaces the template's one double-brace placeholder. For every template file, render it and
compare it with the installed file. Two classes:

- **Owned by the project, merged hunk by hunk**: `AGENTS.md`, `docs/RUNBOOK.md` and
  `.github/workflows/ci.yml` (they grow with the repository, and `ci.yml` has its steps
  trimmed to the project's scripts), `.claude/settings.json`, `.github/dependabot.yml` (it
  may carry extra ecosystems), `.agents/cloud-session-start.sh` (the project adapts it to
  its services). These are never overwritten and never skipped: **on every run, the fast
  path included, diff the installed file against the CURRENT rendered template**, not
  against the delta between the two lock commits. A hunk that landed upstream long ago and
  never reached the project is exactly what this catches. Show
  the diff hunk by hunk, say for each what it is and why (the upstream commit message where
  there is one), and offer to apply it; apply a hunk only on the human's yes for that hunk.
  Merge, never overwrite: a hunk that is the project's own adaptation (an extra ecosystem,
  a trimmed step, a service the project starts) is shown as such and not offered for removal.
  The merge of `.claude/settings.json` is by key: the template owns the `attribution` keys,
  its own `permissions.allow` entries (an installed entry that an upstream commit replaced,
  such as an old wildcard rule, is offered for replacement) and its own hook entries; every
  other key, allow rule and hook of the project stays.
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

## 8. The report (every run)

End with a report that a reader can check against this list:

- the lock commit and the playbook HEAD;
- per kept-identical file: synced, already identical, or declined;
- per project-owned file: identical to the template, or the hunks applied and the hunks
  **declined**. A run that found a difference in a project-owned file and applied nothing
  still says so: file name and the declined hunks, never silence and never "nothing to do";
- new and removed upstream files and what was decided;
- the doc-size report.

Checklist before reporting: all six project-owned files were diffed against the current
template (a missing one is named, not skipped), and none was diffed only against the lock
delta.
