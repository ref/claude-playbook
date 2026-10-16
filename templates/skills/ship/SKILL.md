---
name: ship
description: Take a finished task branch to a pull request: rebase onto its base, run the full gate, run the pre-review, push, open the PR through the REST API with the evidence sections filled. On a feature branch, ship the whole feature to the trunk. Use when asked to ship, push or open a PR for the current branch.
---

You are shipping the current branch: bring it up to date with its base, run the gate, run
the pre-review, push, open the PR. Run this when the work is done and committed.

**`AGENTS.md` "Getting to the trunk" is canonical**: it defines this ritual and this file
executes it. Where they disagree, `AGENTS.md` wins and this file is the bug. A red step
stops the ship; it is never skipped. Every GitHub call is `gh api` (REST): this skill runs
in cloud sessions, where the GraphQL proxy is blocked, and a draft PR cannot be marked
ready without GraphQL, so there are no draft PRs.

Find the trunk and resolve the BASE:

    gh api repos/{owner}/{repo} --jq .default_branch

- The current branch is `feature/<topic>` → a FEATURE SHIP: base is the trunk and steps 2
  and 5 take their feature form below.
- A PR already exists for this branch (`gh api "repos/{owner}/{repo}/pulls?head=<owner>:<branch>"`)
  → its base stands.
- Otherwise the issue decides: its umbrella (`Refs #<umbrella>`) carries
  `Branch: feature/<topic>` → that branch; no such line → the trunk. Unsure → ask, never
  guess the trunk: a sub-task shipped there deploys half a feature.

## 1. Refuse to ship the wrong thing

    git status -sb

- On the trunk → STOP. Agents never push to it.
- Dirty tree → STOP. Commit first, or say what the stray files are.
- Feature ship with unticked umbrella lines → STOP and say which sub-issues are open.

## 2. Bring the branch up to date with its base

A task branch rebases:

    git fetch origin --prune
    git rebase origin/<base>

A feature branch (feature ship) merges the trunk in and never rebases: its open sub-PRs
hang off its commits.

    git fetch origin --prune
    git merge origin/<trunk>

Resolve conflicts honestly, per file. A lockfile is never resolved by hand: resolve the
manifest, then reinstall and let the package manager rebuild the lockfile.

## 3. Run the full gate

Exactly as `AGENTS.md` defines it. Red is a stop: fix the code. Never delete, skip, weaken
or mock away a test to get green; fix formatting with the formatter. If you must change a
test, declare it under `## Tests changed` in step 5.

## 4. Pre-review, then push

Run `/code-review` on your own diff and fix what it finds; the PR body's `## Evidence`
carries its summary. Commit as you go: a cloud session that pauses can lose uncommitted
work. Then:

    git push -u origin <branch>

`--no-verify`, `SKIP_PUSH_GATE` and `ALLOW_DIRECT_PUSH` are the human's overrides and are
forbidden to you.

## 5. Open the PR

Write the body to a scratch file outside the repository, following
`.github/pull_request_template.md` section by section, then:

    gh api -X POST repos/{owner}/{repo}/pulls -f title='<title>' -f head=<branch> -f base=<base> -F body=@<scratch file>

If a PR already exists for this branch, the push updated it: do not open a second one.

**Title:** a conventional commit (`feat(feed): …`); it becomes the squash-commit title and
`pr-hygiene` fails anything else. A feature ship's title names the feature.

**Body:** write these, do not just fill them. `pr-hygiene` tests them for presence; the
reviewer tests them for truth.

- **Issue link:** `Closes #<n>`, `Refs #<n>` for an umbrella that stays open, or `No issue`.
  Exactly one kind. A feature ship writes `Closes #<umbrella>` and, under `## What changed`,
  lists the sub-PRs that make it up (the reviewer checks the diff against that list).
- **`## What changed`:** three lines.
- **`## How to test by hand`:** at most five concrete steps, where to go, what to click,
  what must happen; the only section the human reads before testing. For a feature ship:
  the whole feature end to end on the feature branch.
- **`## Evidence`:** the gate's final lines, the tests added by name, screenshots for UI
  changes, the pre-review's summary. Real output, never a claim.
- **`## Tests changed`:** `none`, or every deleted, skipped or weakened test with the
  reason. `test-integrity` fails a weakened test that is not declared here.
- **`## Docs`:** `* <file> — <what changed>` bullets for every doc the diff makes stale, or
  `Docs: none — <real reason>`. Anything the human runs or must remember goes in the
  RUNBOOK.
- **`## Risk nearby`:** what this could regress.

If the diff touches something `AGENTS.md` flags as one-branch-at-a-time (a schema, a
generated artifact), say so and confirm the generated artifact is in this PR. If test-first
did not apply (docs, config, pure deletion), say so outright.

## 6. Hand off

The reply to the manager is one line: the PR number, its state, and anything blocking.
Print the number as the report. The review runs by itself on the head; a blocker comes back
to you through the app, and you fix it and push again. You never merge, never approve, and
green CI is not permission to merge.
