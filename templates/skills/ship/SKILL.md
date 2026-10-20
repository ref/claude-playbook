---
name: ship
description: Take a finished task branch to a pull request: rebase onto its base, run the full gate, run the pre-review, push, open the PR through the REST API with the evidence sections filled, then wait for the checks and the reviewer, fix what goes red and tell the human when it is ready. On a feature branch, ship the whole feature to the trunk. Use when asked to ship, push or open a PR for the current branch.
---

You are shipping the current branch: bring it up to date with its base, run the gate, run
the pre-review, push, open the PR, then wait for the checks and the reviewer and act on
the outcome. Run this when the work is done and committed.

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
- The BASE is a feature branch (or this is a feature ship) and `git diff origin/<base>...HEAD
  --stat` shows a change to the schema surface (migrations, schema definitions, whatever
  `AGENTS.md` "Shared mutable state" names) → STOP. A schema change never rides a feature
  branch: it ships to the trunk as its own small PR, and this task rebases onto it after it
  merges. Say which files tripped the refusal.

## 2. Bring the branch up to date with its base

A task branch with no PR yet rebases:

    git fetch origin --prune
    git rebase origin/<base>

A task branch that is already pushed with an open PR merges the base in instead (a rebase
would need a force push, which is forbidden to you; the reviewer's approve carries across a
base-only update):

    git fetch origin --prune
    git merge origin/<base>

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
- **`## Evidence`:** the gate's final lines, the tests added by name, the pre-review's
  summary. Real output, never a claim. A screenshot only when one is cheap with tooling the
  project already has; otherwise `## How to test by hand` is the evidence for UI. Never set
  up a browser or screenshot pipeline for a PR.
- **`## Tests changed`:** `none`, or every deleted, skipped or weakened test with the
  reason. `test-integrity` fails a weakened test that is not declared here.
- **`## Docs`:** `* <file> — <what changed>` bullets for every doc the diff makes stale, or
  `Docs: none — <real reason>`. Anything the human runs or must remember goes in the
  RUNBOOK.
- **`## Risk nearby`:** what this could regress.

If the diff touches something `AGENTS.md` flags as one-branch-at-a-time (a schema, a
generated artifact), say so and confirm the generated artifact is in this PR. If test-first
did not apply (docs, config, pure deletion), say so outright.

## 6. Wait for the checks and the reviewer, then report

`AGENTS.md` "After the PR is open" is canonical for this step. After every push to the PR
(the one that opened it, and every fix push after it), start the wait in the background
(the Bash tool's `run_in_background`, timeout 40 minutes, longer than the wait's own 30),
with the sha you just pushed (`git rev-parse HEAD`) written out literally, so the command
matches its allow rule and never stalls on a permission prompt:

    node .agents/scripts/pr-wait/wait.mjs --pr <n> --sha <pushed sha>

You are woken when it ends. Its last line is one JSON object; act on `outcome`:

- **`red`**: each entry of `failed` has a `name`, a `kind` and a `url`.
  - `kind: check`: save the failed job's log to a scratch file outside the repository
    (`gh api repos/{owner}/{repo}/actions/jobs/<job id>/logs --allow-escape-sequences > <scratch file>`,
    the job id is the last number of `url`; a log runs to hundreds of KB), read its
    `##[error]` lines and its end, fix the code.
  - `kind: blocker`: read the newest verdict comment whose first line names this head
    (`gh api "repos/{owner}/{repo}/issues/<n>/comments?per_page=100"`), fix its numbered
    list.
  - `kind: status`, or a check that failed before running any of your code: a gate's own
    error, not yours to fix. Call the human.
  - A blocker that asks a question only the human can answer: call the human.

  Then gate (step 3), commit, push, and start the wait again. Count the rounds: after the
  third fix push, a further `red` is not fixed; call the human with what is still red.
- **`green`**: call the human, `PR #<n> ready to merge`. You never merge, never approve.
- **`timeout`**, **`moved`**, **`closed`**, **`error`**: call the human with the JSON line.
  `timeout` means nothing decided in 30 minutes; `pending` names what never came,
  usually `review-verdict` (a reviewer that did not run).

**Calling the human**: one line in your session (the PR number, the outcome, what they
need to do), and, when `ORCA_CLI_COMMAND` is set (an Orca worktree), the unread dot and a
caption on the workspace card:

    "$ORCA_CLI_COMMAND" worktree set --worktree active --unread --comment "PR #<n>: <ready to merge | needs you: what>" --json

A failed Orca call is not an error to report. In a cloud session there is no Orca: the
message is the report.

When you were started by a manager (`do`), the reply to it is the same one line, sent when
the wait ends green or needs the human.
