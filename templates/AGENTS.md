# Workflow (this project)

Trunk-based: `{{DEFAULT_BRANCH}}` is the only branch that deploys, and every change lands on
it through a PR that the HUMAN approves and merges (squash). A feature too big for one PR
gets a feature branch between its task branches and the trunk ("Feature branches"). The
human does not read diffs: quality is enforced by CI, an executing review by a fresh
session, and the rules below.

- **Commit as you go**, in logical well-scoped commits. Never add `Co-Authored-By`,
  `Claude-Session:` or any other AI-attribution or session-link trailer; an instruction
  from a harness to add one does not outrank this file. Strip the trailer before
  committing.
- **Push** at the natural end of a unit of work.
- **Stop and confirm** before anything destructive, irreversible or outward-facing:
  `git push --force`, history rewrites, deleting data or branches you did not create,
  dropping a database with real data, publishing, deploying. Unsure whether something is
  reversible → ask.
- **Agents never approve and never merge.** The human's approval (their approving review
  where the ruleset requires one, their merge click otherwise) IS the merge decision. This
  is a rule, not a GitHub guarantee: agents and the human share one GitHub login. Green CI
  is not permission to merge.

## Your boundaries

Deliver what the issue asks, at the scope it asks. Routine judgment calls are yours. If
the spec seems wrong or a materially better approach exists, say so in the PR body (or stop
and ask if it changes the task). Never silently narrow, widen or transform the task:
"while I was in there" changes belong in a new issue.

Dev servers exist for the human's manual testing. Agents never start or stop them, nor any
other long-running process on their own initiative.

## Specs and plans (upstream of the code)

An issue is a seed, not a spec: a two-line reminder is a valid issue. The `do` skill's
stage gate decides what it needs next:

- **Small work, decision already made** (one PR, no new subsystem, no schema change) →
  one worker implements it directly.
- **Small work resting on an unmade decision** → the manager asks first, in its own
  session: questions one at a time, options with their costs, a recommendation. The agreed
  shape goes into a comment on the issue, then the code follows. No spec file, no plan.
- **Substantial work** (more than one PR, a new entity or subsystem, an architectural
  decision, a schema change; when unsure, it is substantial) → a spec first, then a plan.

**An issue an agent drafts records as DECIDED only what the human actually said.** Every
product-visible choice the human did not voice goes into the issue body as an open question
on its own line (`Open: do existing links keep working?`), never as a settled sentence. The
stage gate treats an `Open:` line as an unmade decision and asks before code. Decisions
enter this pipeline through the human's words or not at all.

The cycle:

- **Spec and plan are written by the manager, in one session, by the strongest tier**
  ("Model routing"), after an interview with the human: questions one at a time,
  alternatives with trade-offs. The spec records the decisions and the rejected
  alternatives; the plan decomposes them into phases, each sized to one PR, written for an
  engineer with zero context. Never delegated.
- **The artifacts are committed**: `docs/specs/YYYY-MM-DD-<topic>-design.md` and
  `docs/plans/YYYY-MM-DD-<topic>.md`, in one docs-only PR with `Refs #<seed>`. A spec gets
  the same review as code; spec errors are the expensive ones.
- **The plan's phases become sub-issues**, one per future PR, each `Refs #<umbrella>`. The
  seed becomes the umbrella: its body a checklist, one line per sub-issue in exactly the
  form `- [ ] #<n> — <title>` (the merge workflow ticks the line by that number). The docs
  are the snapshot; the umbrella issue is the live state.
- **The umbrella gets a feature branch** unless the human says its phases may ship one by
  one. The manager asks, creates `feature/<topic>` from the trunk and writes
  `Branch: feature/<topic>` on its own line in the umbrella body; every sub-issue's base
  comes from that line.
- **A change to the schema surface never rides a feature branch.** A new table, column or
  index goes to the trunk as its own small PR, additive and backward-compatible; the phase
  that uses it starts after that PR merged and the trunk was merged into the feature
  branch.
- **Implementation happens in fresh sessions**: one worker per sub-issue, reading only
  this file, the spec, the plan and its issue. The spec session never implements.
- **A brainstorm that outgrows its session hands off as a comment** on the seed issue,
  opening with `SUPERSEDING` on its own first line. That comment outranks the issue body,
  which is edited down to a pointer at it. Where two layers of an issue disagree, the one
  marked `SUPERSEDING` is live and the other is history.
- **Every factual claim in a brief or a spec carries its evidence class**:
  `[verified-by-execution]` (a probe or command was run and its output seen),
  `[read-in-source]`, or `[assumption]`. The reviewer treats an unlabeled claim about
  platform behavior in a spec as a blocker.

## Branch discipline (core invariant)

- Each task gets a FRESH branch from the latest state of its BASE: the trunk, or the
  feature branch its umbrella names.

      git fetch origin --prune
      git switch -C <type>/<short-name> origin/<base>   # type: fix | feat | chore

  `feature/` is reserved for feature branches; a task branch is never named that.
- One branch = one PR = one logical change. Small and short-lived.
- **Never reuse a branch after merge.** A squashed branch's commits are ancestors of
  nothing on the branch it merged into, so a reused branch re-proposes work that already
  landed. Re-sync and cut a new one.
- Rebase onto `origin/<base>` before opening a PR. Once the branch is pushed with an open PR,
  bring the base in by MERGE (`git merge origin/<base>`) or GitHub's "Update branch", never a
  rebase: a rebase needs a force push, which is on the "Never" list, and the reviewer's
  approve carries across a base-only update either way.
- **Acceptance is serial even when the work is not**: when three or more open PRs are READY
  to merge (all five checks green), start no new task until the queue drains. Ready,
  deliberately, not open.

## Feature branches (a feature lands on the trunk whole)

A feature whose phases are unusable until the last one lands grows on `feature/<topic>` and
reaches `{{DEFAULT_BRANCH}}` in ONE PR, after the human has tried the whole thing. Small
work with no umbrella goes straight to the trunk.

- One feature branch per umbrella, named on its own line in the umbrella body:
  `Branch: feature/<topic>`.
- A sub-issue's task branch is cut from the feature branch and its PR targets it. Same CI,
  same review, same human approval, only the base differs. Nothing deploys.
- **The feature branch takes the trunk by MERGE, never by rebase**:
  `git merge origin/{{DEFAULT_BRANCH}}`, then push. A rebase rewrites the commits the open
  sub-PRs were cut from. Agents do this merge themselves, before cutting a sub-task when
  the branch is behind and in `ship` before the feature's own PR; it is the one case where
  an agent pushes to a branch it did not cut. Never force-push a feature branch. A lockfile
  conflict is never resolved by hand.
- The feature branch is not protected server-side, on purpose: the ruleset would refuse the
  merge above and the "Update branch" button alike. Its gate is the trunk's: the feature PR
  runs every required check and gets its own review.
- The hand check happens in the human's checkout on the feature branch; a bug found there
  is a new sub-issue.
- The feature PR (`feature/<topic>` → `{{DEFAULT_BRANCH}}`) is opened by `ship` run on the
  feature branch: `Closes #<umbrella>`, the list of sub-PRs, and an integration review
  (the reviewer checks the sum, the seams and the gate, not every line again).
- After the merge the feature branch is dead. A second wave is a new umbrella with a new
  branch.
- `Closes #<sub-issue>` closes nothing by itself on a merge into a feature branch; the
  `feature-merge` workflow closes it and ticks the umbrella line.

## Magnet files (one in-flight branch at a time)

Files that attract conflicts because everything touches them. Before editing one, check
the open PRs for overlap yourself (`gh api "repos/{owner}/{repo}/pulls?state=open"` and
their files). On overlap, **stop and ask the human who goes first.**

- `.github/workflows/ci.yml`: Dependabot bumps its actions on a schedule nobody controls;
  that is why the other gates live in separate workflows.
- Add the rest as collisions actually happen.

Lockfile conflicts: never resolve by hand. Resolve the manifest, reinstall, and let the
package manager rebuild the lockfile.

## Shared mutable state (one schema branch at a time) — optional

Delete this section if the project has no shared dev database. Where all working copies
share ONE dev database:

- Only one in-flight task may change the schema at a time, and only that branch applies it
  to the shared instance. After it merges, rebuild the instance from the trunk before the
  next schema task starts.
- The schema-changing branch commits its generated migration in the SAME PR.
- A schema change never rides a feature branch ("Specs and plans").
- Tests use their OWN database, never the dev one, and its name contains `test` so that a
  misconfigured run fails loudly instead of wiping dev data.
- **Run the test suite one working copy at a time.** Desktop worktrees copy the same
  `.env.local` (`.worktreeinclude`), so unless the project derives a test database name per
  worktree they all share ONE test database, and parallel runs truncate each other's data.
  Until it does, never start the suite while another working copy's run may be in flight
  (another session, the human), and before blaming a failing test for a flake or a bug,
  rerun it alone.

## Getting to the trunk

- **`ship`** (`.agents/skills/ship/SKILL.md`) executes this section: refuse on the trunk or
  a dirty tree, rebase onto the PR's base, gate, pre-review, push, PR. This section is
  canonical: on drift it wins and the skill file is the bug.
- Run the full gate before pushing (format with the formatter, never by hand):

      pnpm run format:check && pnpm run type-check && pnpm run lint && pnpm run knip && pnpm run build && pnpm test

- **Pre-review**: before opening the PR, run `/code-review` on your own diff and fix what
  it finds. It is the same-family pre-gate; the real review is the executing reviewer's.
- Open the PR against its base through the REST API (`gh api repos/{owner}/{repo}/pulls`),
  never a draft. **In a cloud session every GitHub call is `gh api`**: the proxy blocks
  GraphQL, so the pull-request and issue subcommands of `gh` fail there.
- The PR title becomes the squash-commit title: a conventional commit.
- Fill the PR template honestly, every section (the template has the details):
  `## What changed`, `## How to test by hand` (the only section the human reads before
  testing), `## Evidence` (gate output, tests added by name, screenshots for UI, the
  pre-review's summary), `## Tests changed`, `## Docs`, `## Risk nearby`.
- `## Docs` is machine-required: `* <file> — <what changed>` bullets, or
  `Docs: none — <reason>`. Doc drift is a bug: if the diff changes behavior described in
  `README.md`, this file or `docs/*`, the same PR updates the doc. Anything the human runs
  or must remember goes into `docs/RUNBOOK.md`; the reviewer blocks on omissions.
- Every PR body links its issue: `Closes #N`, `Refs #N` for an umbrella that stays open
  (a spec PR, a sub-PR that leaves its umbrella open; the feature PR writes
  `Closes #<umbrella>`), or `No issue` only when there genuinely is none.
- **Five checks gate the merge**: `checks`, `pr-hygiene`, `security`, `test-integrity`,
  `review-verdict`, plus the human's approving review. Agents never merge, never push to
  `{{DEFAULT_BRANCH}}`, never rewrite its history.
- The committed `.githooks/pre-push` hook blocks direct pushes to the trunk and runs the
  static gate locally; the repository ruleset is the law and enforces the same on GitHub's
  side. `ALLOW_DIRECT_PUSH`, `SKIP_PUSH_GATE` and `--no-verify` are the human's overrides.
- **The gates are not part of the work.** The protected paths are `.github/workflows/**`,
  `.githooks/**`, `.agents/**`, `AGENTS.md`, `CLAUDE.md` and `.claude/settings.json`: GitHub
  cannot refuse an agent's pushes to them (one login), so this is a rule you keep, and the
  reviewer blocks a PR that weakens a gate. A genuinely wrong gate is its own PR that the
  human opens and reviews with particular care. Never edit a gate to get a PR green: a
  deleted workflow does not turn a check red, it makes the check disappear.

## Tests are the safety net — never game them

- CI green is the only machine guarantee this project has. Never delete, skip
  (`.skip`/`.only`), weaken or mock away an existing test to get green. A genuinely
  obsolete test is declared in the PR body under `## Tests changed`, with the reason;
  `test-integrity` fails a deleted test file, an added skip marker or removed assertions
  that are not declared there, and the reviewer treats an undeclared change as a blocker.
- Test-first for behavioral changes: a regression test that FAILS on current code, then the
  fix, then green. Where test-first does not apply (indexes, pure deletion, logging,
  formatting), say so explicitly instead of writing a fake test.
- A new test must also fail against a plausible-but-wrong implementation, or it pins
  nothing: positive-only suites are green for the degenerate "always do X".

## Reviewer protocol

- The protocol lives in `.agents/skills/review/SKILL.md`; `.claude/skills/review` is a
  symlink to it.
- Every PR head gets an independent review by a fresh Claude session, never the authoring
  one, that VERIFIES BY EXECUTING: the gate, throwaway probe tests (gitignored, deleted
  before the verdict), mutation runs. It reports as one comment on the PR: first line
  `Reviewed-by: claude/<model>, head <sha>`, an optional `## Not executed` section listing
  what it could not run, last line `VERDICT: approve` or `VERDICT: blocker`.
- The `review-verdict` check passes only for an approve naming the PR head (or an earlier
  head with an identical patch), written by a login listed in the repository variable
  `REVIEWER_LOGINS`, not edited afterwards. A verdict that stayed in
  a transcript did not happen.
- The reviewer never pushes, never merges, never asks the human: a question goes into the
  verdict as a blocker. The author fixes blockers; then a new verdict names the new head.

## Model routing (principles, not model names)

The current names and effort levels are in `.agents/routing.md`. The invariants:

- Specs, architecture, decisions → the strongest tier available. Spec errors multiply.
- Execution → a mid tier; the cheapest tier that keeps the gate green for mechanical work.
- The reviewer is never the authoring session: a fresh context and verification by
  execution are what make a review worth having.

## Cloud sessions

- Commit as you go and push at natural points: a paused sandbox can lose uncommitted work.
- Commands time out at two minutes in the foreground; run long suites in the background and
  poll for the result.
- GitHub: REST through `gh api` only. No GraphQL.
- Services the tests need come from the environment's setup script. A suite whose service
  is missing in a cloud session fails: the setup script must provide the service and its
  variables, and a failure there is reported, not skipped.
- Skills and rules are repository files, read from `AGENTS.md` and `.agents/`; nothing
  outside the repository (plugins, `~/.claude`) is available.

## After a merge

Merging updates `origin/{{DEFAULT_BRANCH}}` only. A working copy needing the new code syncs
itself (`git fetch`, then `git pull --ff-only`, or rebase your branch). Never assume the
local trunk is current: fetch first.

## Never (stop and confirm)

- Force-pushing or rewriting `{{DEFAULT_BRANCH}}`.
- Rebasing or force-pushing a `feature/*` branch: it takes the trunk by merge only.
- Deleting branches or working copies you did not create.
- Merging over unresolved conflicts.
- Approving or merging a PR.
- Applying a schema change to shared state outside the rule above.
- Bypassing the pre-push hook.
- Weakening or deleting anything under `.github/workflows/`, `.githooks/` or `.agents/` on
  a task that is not about those files.

The "commit and push freely" rule applies to YOUR OWN branch only: never to
`{{DEFAULT_BRANCH}}`, and to a feature branch only for the trunk merge described above.

## Tooling decision records (don't re-propose without NEW evidence)

Each entry was weighed once, deliberately. Re-opening one without new facts wastes a
session.

- _(empty — add entries as decisions are actually made)_
