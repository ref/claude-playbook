# claude-playbook v2, milestone 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v2 playbook far enough to adopt it into one project and take one real PR
from a cloud worker through the gates, the executing review and the owner's approval.

**Architecture:** The playbook repository holds `templates/` (copied into projects verbatim,
one placeholder) and `docs/` (SETUP for the human, ADOPT for an agent). Guarantees are GitHub
workflows backed by two small dependency-free Node scripts (`review-verdict`,
`test-integrity`) and one for PR hygiene; protocols are skills under `.agents/skills/`; the
reviewer is a Claude cloud session started by a routine. Milestone 1 excludes the audit skills,
the Rust fragments and the schema-lock port (separate plans).

**Tech Stack:** Markdown, GitHub Actions YAML, Node ≥ 22 ESM (`.mjs`, zero dependencies,
`node:test`), `gh` (REST through `gh api` wherever a cloud session may run it), `actionlint`.

**Spec:** `docs/superpowers/specs/2026-10-16-claude-playbook-v2-design.md`

**Reference (v1):** `github.com/ref/agent-playbook` — every "port from v1" step reads the
named file there (`gh repo clone ref/agent-playbook` into a temporary directory).

## Global Constraints

- Everything in this repository is English; no private project names, personal names,
  e-mail addresses or local paths in files or commit messages (the repository is public).
- Conventional commit titles; no `Co-Authored-By` or any attribution trailer; this
  repository takes direct commits on `main` (it ships the workflow, it does not follow it).
  Commits are signed and the signing prompt needs the owner's approval: run `git commit`
  and `git push` in the background.
- `templates/` carries exactly one placeholder, `{{DEFAULT_BRANCH}}`; every other value is
  hardcoded for the stack: pnpm, TypeScript, GitHub, Claude Code.
- Scripts: ESM `.mjs`, no npm dependencies, tests with `node:test` next to the script as
  `<name>.test.mjs`, run with `npm test`, which is
  `node --test "templates/scripts/**/*.test.mjs"` (Node's runner takes no directory
  argument; a quoted glob, every depth). A single module's tests run with the same form
  narrowed to its directory, e.g. `node --test "templates/scripts/review-verdict/*.test.mjs"`.
- Every skill is `templates/skills/<name>/SKILL.md` with YAML frontmatter `name:` and
  `description:`; installed at `.agents/skills/<name>/SKILL.md` with a relative symlink
  `.claude/skills/<name> -> ../../.agents/skills/<name>`.
- Any `gh` call that a cloud session may execute is `gh api` (REST). `gh pr …`, `gh issue …`
  (GraphQL) appear only in skills that run exclusively on the desktop (`status`).
- Verdict grammar, exact: line 1 `Reviewed-by: claude/<model>, head <sha>`; last line
  `VERDICT: approve` or `VERDICT: blocker`; one optional section `## Not executed` listing
  what the reviewer could not run.
- PR body headings, exact: `## What changed`, `## How to test by hand`, `## Evidence`,
  `## Tests changed`, `## Docs`, `## Risk nearby`; the issue link is `Closes #<n>`,
  `Refs #<n>` or `No issue`.
- Status contexts, exact: `review-verdict`, `test-integrity`, `pr-hygiene`, `security`,
  `checks`.

## Review Focus

1. A rebase that leaves the PR's content identical (same diff against the merge base):
   the carried approve must still pass — Task 3 test `carries approve across identical patch-id`.
2. The agent identity posting a comment shaped like a verdict: it must be ignored, only
   the reviewer login counts — Task 3 test `ignores verdict-shaped comments from other logins`.
3. Two reviewer verdicts for the same head, approve then blocker: the latest wins — Task 3
   test `latest verdict for the head wins`.
4. A renamed test file (`git diff --name-status` R): not a deletion — Task 4 test
   `rename is not a deletion`.
5. `## Tests changed` present but reading `none` while a test file was deleted: not a
   declaration — Task 4 test `"none" under Tests changed does not declare a deletion`.

---

### Task 1: Repository skeleton and its own CI

**Files:**
- Create: `README.md`, `LICENSE` (MIT), `.gitignore`, `package.json`,
  `.github/workflows/ci.yml`, `templates/scripts/smoke.test.mjs`

**Interfaces:**
- Produces: `npm test` as the test command (the quoted glob above); CI job `checks` running
  it plus `actionlint` over `templates/workflows/**/*.yml` and `.github/workflows/*.yml`.

- [x] **Step 1: Write `templates/scripts/smoke.test.mjs`** — one `node:test` case asserting
  the Node major is ≥ 22.
- [x] **Step 2: Run `npm test` → PASS** (1 test).
- [x] **Step 3: Write `package.json`** — `"type": "module"`, `"private": true`,
  `"engines": {"node": ">=22"}`, scripts
  `test: node --test "templates/scripts/**/*.test.mjs"`; no dependencies.
- [x] **Step 4: Write `.github/workflows/ci.yml`** — on `push` to `main` and `pull_request`;
  one job `checks` with `timeout-minutes: 10`: checkout, `actions/setup-node` with
  `node-version: 22`, `npm test`, then `rhysd/actionlint` (pinned by sha) over
  `templates/workflows` and `.github/workflows`. `templates/workflows/` may be empty at this
  point: guard the actionlint step with a glob that tolerates no files.
- [x] **Step 5: Write `README.md`** — five lines: what this is (the owner's Claude Code
  workflow: a manager session, cloud workers, an executing reviewer, GitHub gates), the link to
  the spec, the one-sentence adoption instruction ("open a session in your repository and say:
  read docs/ADOPT.md from github.com/ref/claude-playbook and install it"), the sync command
  (`/playbook-update`), the license.
- [x] **Step 6: Write `.gitignore`** (`node_modules/`, `.claude/worktrees/`) and `LICENSE`
  (MIT, the year and the owner's GitHub handle only).
- [x] **Step 7: Commit** — `chore: repository skeleton with node:test and actionlint CI`.
- [x] **Step 8: Push and confirm the `checks` run is green on GitHub** (`gh run list -L1`).

### Task 2: Identities, environments, presets — and the plumbing spike

The spike is throwaway; its findings are the deliverable. It runs in the FIRST ADOPTER's
checkout, in a session there, not in this repository.

**Files:**
- Create: `docs/SETUP.md` (sections 1–3 only), `docs/spikes/2026-10-review-plumbing.md`

**Interfaces:**
- Produces: the names `agent` and `reviewer` for the two machine users' roles, the two cloud
  environment names (`<repo>-worker`, `<repo>-reviewer`), the two desktop presets (`agent`,
  `reviewer`), and the spike's answers consumed by Tasks 3, 7 and 10.

- [x] **Step 1: Write `docs/SETUP.md` §1 Identities** — the human creates two GitHub
  accounts; fine-grained tokens per the spec 6.3 (agent: contents write, pull requests write,
  issues write, metadata read; reviewer: contents read, pull requests write, commit statuses
  write, issues read, metadata read); both invited as collaborators with Write; token expiry
  one year with a calendar reminder.
- [x] **Step 2: Write §2 Cloud environments** — per project two environments: worker (agent
  token as a network secret named `GH_TOKEN`, trusted network), reviewer (reviewer token as
  `GH_TOKEN`); setup script `templates/cloud-setup.sh` placeholder named here, written in
  Task 10.
- [x] **Step 3: Write §3 Desktop presets** — `agent` and `reviewer` presets carrying
  `GH_TOKEN`; the owner's own shell keeps the owner's `gh auth`.
- [ ] **Step 4: Run the spike in the first adopter** — on a throwaway branch and PR, with a
  routine whose prompt is literally: "Post a comment on PR #<n> through `gh api` with the body
  `Reviewed-by: claude/spike, head <sha>` and `VERDICT: approve`, then set a commit status
  `spike` = success on that sha through `gh api`." Record in
  `docs/spikes/2026-10-review-plumbing.md`, one line each with the observed value:
  the login a cloud push appears under; whether `gh api` in the cloud authenticates as
  `GH_TOKEN`; which PR events a routine can be triggered on and whether `synchronize` is
  among them; the login of the posted comment; whether the status API call succeeded;
  the time from PR open to comment; limits consumed (from the session's usage view).
- [ ] **Step 5: Decide and record the launch mode** at the end of the spike file: `routine`
  if a routine fires on PR open and on push; otherwise `manager-spawned` (spec 6.1
  fallback). Task 10 §Routine reads this line.
- [x] **Step 6: Commit** — `docs: identities, environments, presets; review plumbing spike`.

### Task 3: `review-verdict` script and workflow

**Files:**
- Create: `templates/scripts/review-verdict/verdict.mjs`,
  `templates/scripts/review-verdict/verdict.test.mjs`,
  `templates/workflows/review-verdict.yml`

**Interfaces:**
- Produces: `export const REVIEWED_BY_RE`, `export const VERDICT_RE`;
  `export function evaluate({ comments, headSha, reviewerLogins, patchIds })` →
  `{ ok: boolean, state: 'approve' | 'blocker' | 'none', sha: string | null, reason: string }`
  where `comments` is `[{ login, body, createdAt }]` (ISO strings), `reviewerLogins` is
  `string[]`, `patchIds` is `{ [sha]: string }` (may lack entries). CLI:
  `node verdict.mjs --head <sha> --reviewers a,b --comments <json-file> --patch-ids <json-file>`
  prints the result as JSON and exits 0 when `ok`, 1 otherwise.
- Consumed by: Task 7 (the skill quotes the grammar), Task 9 (RUNBOOK explains the status).

- [ ] **Step 1: Write the failing tests** in `verdict.test.mjs`:
  - `approve for the head passes` — one reviewer comment, `head` = headSha → `ok: true`.
  - `blocker for the head fails` → `ok: false, state: 'blocker'`.
  - `no verdict fails with reason "no verdict for <sha>"`.
  - `ignores verdict-shaped comments from other logins` — same body, login not in
    `reviewerLogins` → `state: 'none'`.
  - `latest verdict for the head wins` — approve at T1, blocker at T2 → `blocker`.
  - `carries approve across identical patch-id` — approve for `shaA`, head `shaB`,
    `patchIds[shaA] === patchIds[shaB]` → `ok: true, sha: 'shaA'`, reason mentions "carried".
  - `does not carry across different patch-id` → `ok: false`.
  - `malformed Reviewed-by line is not a verdict` (missing `head`) → `state: 'none'`.
  - `CLI exits 1 on blocker` — spawn `node verdict.mjs …` with fixture files.
- [ ] **Step 2: Run `node --test "templates/scripts/review-verdict/*.test.mjs"` → FAIL** (module missing).
- [ ] **Step 3: Implement `verdict.mjs`** — the regexes from Global Constraints; parse only
  comments whose `login` is in `reviewerLogins` and whose body matches both regexes; for each,
  resolve `effectiveFor = sha === headSha || (patchIds[sha] && patchIds[sha] === patchIds[headSha])`;
  take the latest by `createdAt` among those effective for the head; `ok` iff its verdict is
  `approve`. Reason strings: `"approve for <sha>"`, `"approve carried from <sha>"`,
  `"blocker for <sha>"`, `"no verdict for <sha>"`.
- [ ] **Step 4: Run the tests → PASS.**
- [ ] **Step 5: Write `templates/workflows/review-verdict.yml`** — triggers:
  `pull_request` (`opened`, `synchronize`, `reopened`) and `issue_comment` (`created`,
  `edited`, limited by an `if:` to comments on PRs). Permissions: `contents: read`,
  `pull-requests: read`, `statuses: write`. Steps: resolve the PR number and head sha
  (`gh api repos/${{ github.repository }}/pulls/<n>` on `issue_comment`); checkout with
  `fetch-depth: 0`; fetch the PR head; list comments (`gh api …/issues/<n>/comments
  --paginate`) to a file; for the head and for every sha named in a reviewer comment that
  exists in the repository compute `git diff $(git merge-base origin/<base> <sha>) <sha> |
  git patch-id --stable` into a JSON map; run the CLI with `--reviewers` from the repository
  variable `REVIEWER_LOGINS`; post a commit status `review-verdict` on the head sha with the
  reason as the description, `success`/`failure` by exit code. The job reports failure only
  through the status, never through its own exit code (so a failed job does not double up).
- [ ] **Step 6: Run `actionlint templates/workflows/review-verdict.yml` → no findings.**
- [ ] **Step 7: Commit** — `feat(review-verdict): verdict evaluation script and workflow`.

### Task 4: `test-integrity` script and workflow

**Files:**
- Create: `templates/scripts/test-integrity/integrity.mjs`,
  `templates/scripts/test-integrity/integrity.test.mjs`,
  `templates/workflows/test-integrity.yml`

**Interfaces:**
- Produces: `export function isTestPath(path)`;
  `export function findings({ nameStatus, diff, body })` →
  `{ items: [{ kind: 'deleted-test-file' | 'skip-marker-added' | 'assertions-removed', path, detail }], declared: boolean, ok: boolean }`
  where `nameStatus` is the text of `git diff --name-status <base>...<head>`, `diff` the
  text of `git diff <base>...<head> -- <test paths>`, `body` the PR body. CLI:
  `node integrity.mjs --base <ref> --head <ref> --body-file <file>` runs the two git
  commands itself, prints JSON, exits 0 when `ok`.

- [ ] **Step 1: Write the failing tests**:
  - `isTestPath` — true for `src/a.test.ts`, `tests/b.ts`, `src/__tests__/c.tsx`,
    `tests/d.rs`, `e.spec.mjs`; false for `src/a.ts`, `docs/testing.md`.
  - `deleted test file is a finding` — `D\tsrc/a.test.ts`.
  - `rename is not a deletion` — `R100\tsrc/a.test.ts\tsrc/b.test.ts` → no items.
  - `skip marker added is a finding` — a `+` line containing `it.skip(`; also `.only(`,
    `xit(`, `xdescribe(`, `#[ignore]`.
  - `removed assertions are a finding` — removed lines containing `expect(` outnumber added
    ones in a test file → `assertions-removed` with `detail` = the net count.
  - `declaration under "## Tests changed" makes it ok` — body section with one non-empty
    line that is not `none` → `declared: true, ok: true`.
  - `"none" under Tests changed does not declare a deletion` → `declared: false, ok: false`.
  - `no findings is ok without a declaration`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `integrity.mjs`** — parse name-status lines by tab; parse the diff
  into per-file hunks by `diff --git` headers; markers and `expect(`/`assert` counted on
  `+`/`-` lines only; the declaration is the text between `## Tests changed` and the next
  `## ` heading, trimmed, non-empty and not equal to `none` (case-insensitive).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Write `templates/workflows/test-integrity.yml`** — on `pull_request`
  (`opened`, `synchronize`, `reopened`, `edited`); permissions `contents: read`,
  `pull-requests: read`; checkout `fetch-depth: 0`; write the PR body from
  `github.event.pull_request.body` to a file; run the CLI with `--base origin/<base>`
  `--head HEAD`; the job is named `test-integrity` and its own exit code is the check (the
  ruleset requires it by that job name).
- [ ] **Step 6: `actionlint` → no findings. Commit** —
  `feat(test-integrity): weakened-test detection script and workflow`.

### Task 5: PR hygiene script and the ported workflows

**Files:**
- Create: `templates/scripts/pr-hygiene/hygiene.mjs`, `templates/scripts/pr-hygiene/hygiene.test.mjs`,
  `templates/workflows/pr-hygiene.yml`, `templates/workflows/ci.yml`,
  `templates/workflows/ci-docs.yml`, `templates/workflows/security.yml`,
  `templates/workflows/feature-merge.yml`
- Reference: v1's `templates/workflows/*.yml` in the `agent-playbook` repository (port, do not
  invent).

**Interfaces:**
- Produces: `export function check({ title, body })` → `{ ok, problems: string[] }`; CLI
  `node hygiene.mjs --title-file --body-file`, exit 1 with problems listed.

- [ ] **Step 1: Write the failing tests** — conventional title required (`feat(x): y`
  passes, `Update stuff` fails); exactly one of `Closes #<n>` / `Refs #<n>` / `No issue`
  required; each heading of the Global Constraints list present; `## How to test by hand`,
  `## Evidence`, `## Tests changed`, `## Docs` non-empty (a heading followed directly by the
  next heading is a problem); `## Docs` content must be `* ` bullets or start with
  `Docs: none —`; a Dependabot title (`chore(deps): bump …`) with the Dependabot body is
  exempt from everything but the title.
- [ ] **Step 2: Run → FAIL. Step 3: Implement. Step 4: Run → PASS.**
- [ ] **Step 5: Write `pr-hygiene.yml`** — on `pull_request` (`opened`, `edited`,
  `synchronize`, `reopened`); job name `pr-hygiene`; runs the CLI on the event's title and body.
- [ ] **Step 6: Port `ci.yml`, `ci-docs.yml`, `security.yml`, `feature-merge.yml` from v1**
  — same job names (`checks` in both ci files; `security`); `{{DEFAULT_BRANCH}}` where v1 had
  it; drop every Rust block and placeholder (milestone 2); ci.yml steps: `format:check`,
  `type-check`, `lint`, `knip`, `build`, `test` via pnpm with a frozen lockfile and
  `.nvmrc`; `ci-docs.yml` `paths:` stays the exact inverse of `ci.yml` `paths-ignore:`;
  every job keeps `timeout-minutes`.
- [ ] **Step 7: `actionlint templates/workflows/*.yml` → no findings. Commit** —
  `feat(workflows): pr-hygiene script; ci, docs twin, security, feature-merge ported`.

### Task 6: Static templates

**Files:**
- Create: `templates/pull_request_template.md`, `templates/dependabot.yml`,
  `templates/githooks/pre-push`, `templates/settings.json`, `templates/worktreeinclude`,
  `templates/CLAUDE.md`, `templates/scripts/check-templates.mjs`,
  `templates/scripts/check-templates.test.mjs`
- Reference: v1's `templates/pull_request_template.md`, `dependabot.yml`, `githooks/pre-push`,
  `settings.json`.

**Interfaces:**
- Produces: `check-templates.mjs` with `export function placeholders(text)` → the set of
  `{{…}}` tokens; `export function brokenRefs(text, existingPaths)` → referenced
  `.agents/…`, `.github/…`, `.githooks/…`, `docs/…` paths not in `existingPaths`;
  CLI walks `templates/` and fails on any placeholder other than `{{DEFAULT_BRANCH}}` or any
  broken reference; a `node:test` case runs the CLI over the repository.

- [ ] **Step 1: Write the PR template** — the headings from Global Constraints in order,
  with one-line hints under each; `## How to test by hand` hint says "at most five steps,
  the only section the human reads before testing".
- [ ] **Step 2: Port `dependabot.yml`** (npm + github-actions, grouped weekly, cooldown 3
  days minor/patch, 14 majors; no cargo block) and `githooks/pre-push` (refuse pushes to
  `{{DEFAULT_BRANCH}}` unless `ALLOW_DIRECT_PUSH=1`; run the static gate unless
  `SKIP_PUSH_GATE=1`). Verify: `sh -n templates/githooks/pre-push`.
- [ ] **Step 3: Write `settings.json`** — `attribution` keys empty; `permissions.allow` for
  `Bash(node .agents/scripts/*:*)`; no hooks.
- [ ] **Step 4: Write `worktreeinclude`** (comment header; `.env` and `.env.local`
  as the two default lines) and `CLAUDE.md` (`@AGENTS.md` and one Claude-only line: run
  `/code-review` before `/ship`). No `CODEOWNERS` template: ADOPT writes it from the
  owner's login (Task 10).
- [ ] **Step 5: Write the failing `check-templates` tests, then the script, run → PASS;
  add `node templates/scripts/check-templates.mjs` to `package.json` `test` after
  `node --test`.**
- [ ] **Step 6: Commit** — `feat(templates): PR template, dependabot, hook, settings, worktreeinclude, template checks`.

### Task 7: The `review` skill

**Files:**
- Create: `templates/skills/review/SKILL.md`, `templates/scripts/review-verdict/skill-grammar.test.mjs`
- Reference: v1's `templates/skills/review/SKILL.md` (the executing protocol: probe tests,
  mutation runs, the gate, docs honesty, gate integrity, the verdict comment).

- [ ] **Step 1: Write the failing grammar test** — reads the SKILL.md, asserts it contains
  one example block whose first line matches `REVIEWED_BY_RE` and whose last line matches
  `VERDICT_RE` (import both from `verdict.mjs`), and contains the literal `## Not executed`.
- [ ] **Step 2: Run → FAIL. Step 3: Write `SKILL.md`** — frontmatter; sections: Scope (the
  PR number given, `gh api` only, never checkout another ref than the PR head the session was
  opened on); Verify by executing (install with a frozen lockfile, run the gate, write
  throwaway probe tests under `tmp/` deleted before the verdict, at least one mutation run per
  changed behavior); What to check (tests weakened or deleted — cross-check with the PR's
  `## Tests changed`; gate files touched; docs drift against `## Docs`; evidence in the body
  matches what you observed; scope matches the issue); Not executed (list what could not run
  and why); The verdict (the exact grammar, posted with
  `gh api repos/<o>/<r>/issues/<n>/comments -f body=@file`; a verdict that stayed in the
  transcript did not happen); Never (push, merge, close, edit the PR, ask the human — a
  question goes into the verdict as a blocker); Runtime notes (cloud: 2-minute commands, run
  long suites in the background and poll; local: the same protocol).
- [ ] **Step 4: Run → PASS. Commit** — `feat(skills): review protocol for an executing reviewer`.

### Task 8: `do`, `ship`, `status` skills and the worker brief

**Files:**
- Create: `templates/skills/do/SKILL.md`, `templates/skills/ship/SKILL.md`,
  `templates/skills/status/SKILL.md`, `templates/agents/worker-brief.md`,
  `templates/agents/routing.md`
- Reference: v1's `do` and `ship` skills (the stage gate, the spec/plan cycle, the umbrella
  checklist, the feature-branch rules, the ship tail).

- [ ] **Step 1: Write `routing.md`** — the table from spec 6.7 with the current model
  names in a second column (`Fable 5.1`, `Opus 5.5`, `Sonnet 5.5`) and the effort levels;
  one line saying `AGENTS.md` carries the principles and this file the names.
- [ ] **Step 2: Write `worker-brief.md`** — the template from spec 6.6: first line
  `/model <tier>` `/effort <level>`; then the fields as `**Field:** value` lines; a final
  "Report" line: `one line to the manager: PR number, state, blocking item`.
- [ ] **Step 3: Write `do/SKILL.md`** — frontmatter; Stage gate (v1's three outcomes);
  Spec and plan (the manager writes both, commits them in a docs PR with `Refs #<seed>`,
  files sub-issues with the umbrella checklist line form `- [ ] #<n> — <title>`, asks the
  human "feature branch or one by one", writes `Branch: feature/<topic>` into the umbrella);
  The human brief (≤150 words, plain words, a mockup for a screen; never the spec);
  Spawning (fill `worker-brief.md`; start a child session with target cloud by default, a
  local worktree session as fallback, model and effort from `routing.md`; parallel only
  where the plan marks phases independent); Relay (blockers from review verdicts to the
  worker; reports to the human: "PR #n ready, test: …"); Restart (how to resume from the
  umbrella issue after a context loss: read the checklist, the open PRs, the latest
  verdicts). The manager never writes product code.
- [ ] **Step 4: Write `ship/SKILL.md`** — for a worker: refuse on the default branch or a
  dirty tree; rebase onto the base; run the gate; run `/code-review` and fix findings;
  fill the PR body sections from the template with real evidence (the gate's final lines,
  the test names added, screenshots for UI); create the PR through
  `gh api repos/<o>/<r>/pulls` (REST) against the base; print the PR number as the report.
  On a feature branch: merge the trunk in first, then the feature PR with `Closes #<umbrella>`.
- [ ] **Step 5: Write `status/SKILL.md`** — desktop only (`gh pr list`, `gh issue list`
  allowed): feature branches against umbrellas, PRs by stage from their `review-verdict`
  status and checks, open issues; answer in the chat in ≤15 lines.
- [ ] **Step 6: Run `npm test` (check-templates verifies the references) → PASS. Commit** —
  `feat(skills): do, ship, status; worker brief and routing table`.

### Task 9: `AGENTS.md` and `RUNBOOK.md`

**Files:**
- Create: `templates/AGENTS.md`, `templates/RUNBOOK.md`
- Reference: v1's `templates/AGENTS.md` and `templates/RUNBOOK.md` — port the rules that
  survive, drop every section about cmux, pills, the question page, worktree scripts, the
  local reviewer launcher, the dashboard.

- [ ] **Step 1: Write `AGENTS.md`** — sections, in order: Workflow (trunk, PRs, the human
  approves, agents never approve or merge); Your boundaries (v1); Specs and plans (v1 minus
  the page); Branch discipline (v1); Feature branches (v1); Magnet files (v1); Shared
  mutable state (v1, marked optional); Getting to the trunk (the gate line with pnpm, the
  PR body sections, `gh api` only in the cloud, the pre-review, the gates are not part of
  the work, protected paths named); Tests are the safety net (v1 plus "declare under
  `## Tests changed`"); Reviewer protocol (fresh session, executes, the verdict grammar,
  never pushes); Model routing (principles only, pointer to `.agents/routing.md`); Cloud
  sessions (commit as you go, 2-minute commands, REST only, no local DB); After a merge
  (v1); Never (v1 minus deleted modules); Tooling decision records (v1, empty).
- [ ] **Step 2: Write `RUNBOOK.md`** — Daily development (`/do <n>`, the four touchpoints);
  Approving and merging (your approval is the merge; what the `review-verdict` status
  description means, including "approve carried from"; after "Update branch" re-approve, no
  re-test when carried); When a verdict never lands (run `/review <n>` yourself in a
  `reviewer`-preset session); Feature branches (v1, shortened); Routing (pointer to
  `.agents/routing.md`); Dependency cooldowns (v1); CI shape (v1, with the two new checks);
  Emergency overrides (v1); When something looks broken (v1's table minus cmux rows, plus
  rows for a missing `review-verdict` status and a failed `test-integrity`).
- [ ] **Step 3: Run `npm test` → PASS (no stray placeholders, every referenced path
  exists). Commit** — `feat(templates): AGENTS.md and RUNBOOK.md for v2`.

### Task 10: SETUP (rest), ADOPT, cloud setup script, `playbook-update` and `playbook-compact`

**Files:**
- Modify: `docs/SETUP.md` (§4–§7)
- Create: `docs/ADOPT.md`, `templates/cloud-setup.sh`,
  `templates/skills/playbook-update/SKILL.md`, `templates/skills/playbook-compact/SKILL.md`
- Reference: v1's `ADOPT.md` Rule 0 and "Verify the installation"; v1's `playbook-update`
  and `playbook-compact` skills.

- [ ] **Step 1: SETUP §4 Ruleset** — the exact rules from spec 6.3 as a checklist in the
  GitHub UI's order: require PR; required approvals 1, require code-owner review, dismiss
  stale; required status checks `checks`, `pr-hygiene`, `security`, `test-integrity`,
  `review-verdict` (strict, up to date); squash only, delete branch on merge; block force
  pushes and deletions; bypass list: the owner; push ruleset "restrict file paths" for the
  six protected paths, bypass the owner only. Repository variable `REVIEWER_LOGINS` = the
  reviewer account's login.
- [ ] **Step 2: SETUP §5 The reviewer routine** — per the spike's launch-mode line: the
  routine's trigger events, environment (`<repo>-reviewer`), model and effort from
  `routing.md`, prompt text literally "Run `/review <pr>` as `.agents/skills/review/SKILL.md`
  describes, for the pull request this event names."; the `manager-spawned` fallback text.
- [ ] **Step 3: SETUP §6 Cloud environments** — `templates/cloud-setup.sh`: `corepack
  enable`, `pnpm install --frozen-lockfile`, start services from `docker compose` when a
  compose file exists, export the test database URL; finishes under five minutes or it is
  not cached. SETUP explains the two environments and the setup script per project.
- [ ] **Step 4: SETUP §7 The machine** — desktop app: worktrees on, auto-archive after
  merge, branch prefix; the `agent` and `reviewer` presets (from §3).
- [ ] **Step 5: Write `docs/ADOPT.md`** — a document an agent follows, not a skill (a skill
  cannot be invoked before it is installed): Rule 0 (never overwrite without the diff and a
  yes); the install table (template → destination, `{{DEFAULT_BRANCH}}` rendered from
  `gh repo view`, plus `.github/CODEOWNERS` written as `* @<login>` from `gh api user`); the relative
  symlinks; `.gitignore` line; `.agents/playbook.lock` with `commit` and `synced`; the v1
  removal list (`.cmux/`, `.agents/task-status*`, `.agents/dashboard*`, `.agents/ask*`,
  `.agents/auto-review.sh`, `.agents/guard-reviewer.sh`, `.agents/hooks.json`,
  `scripts/*-task.mts`, `scripts/*worktree*.mts`, the task-status hooks in
  `.claude/settings.json`, the `dashboard` skill) each shown and confirmed; the verification
  checklist (symlinks resolve, no placeholder survived, `core.hooksPath`, hook refuses a
  push to the trunk, ruleset active, the five checks appear on a test PR).
- [ ] **Step 6: Port `playbook-update` and `playbook-compact`** — update: read the lock,
  shallow-clone this repository, diff `templates/` against the installed files, show, write
  on yes, bump the lock; compact: v1's skill unchanged except file paths.
- [ ] **Step 7: `npm test` → PASS. Commit** —
  `docs: SETUP ruleset, routine, cloud environments, machine; ADOPT; update and compact skills`.

### Task 11: Adopt into the first project and run one real PR end to end

Runs in a session opened in the first adopter's checkout, with this repository's `main`
pushed. Nothing here changes this repository except the final note.

**Files:**
- Modify (this repository): `docs/SETUP.md` (a "verified on" line), `README.md` (status line)

- [ ] **Step 1: In the adopter: "read docs/ADOPT.md from github.com/ref/claude-playbook
  and install it"** — the session shows every diff and the v1 removal list; the owner
  confirms each; the lock is written.
- [ ] **Step 2: The owner completes SETUP §1–§7** for that repository (identities exist from
  Task 2; the ruleset, variable, routine, environments, presets).
- [ ] **Step 3: Verification checklist from ADOPT** — every item green, recorded in the
  adopter's `docs/RUNBOOK.md` under "Verified".
- [ ] **Step 4: One real small issue through the whole cycle** — `/do <n>` in a desktop
  session under the `agent` preset → one cloud worker → PR → all five checks → the routine's
  verdict → the owner's approval → merge. Record: time from PR open to verdict, limits used
  by the worker and the reviewer, anything that prompted the human.
- [ ] **Step 5: Fix what the run exposed** in this repository (each fix its own commit with
  a conventional title), re-sync the adopter with `/playbook-update`.
- [ ] **Step 6: Commit** — `docs: first adoption verified; status in README`.

---

## Deferred to later plans

- Audits: `/audit`, `/audit-external` (and `.agents/audit-external-prompt.md`),
  `/audit-triage` — spec 6.8.
- Rust/Tauri: the cloud-build spike and v1's `rust/` fragments — spec 7.
- Schema-lock and the shared-DB rules as an optional module — spec 6.5.
- Migrating the remaining v1 repositories; retiring the `agent-playbook` repository with a
  pointer to this one.

## Rulings

Decisions taken during execution, one line each.

- Task 2: documents only. Steps 4 and 5 (running the spike, recording the launch mode) are
  left unticked and wait for the owner; `docs/spikes/2026-10-review-plumbing.md` holds the
  procedure, an empty results table and `Launch mode: pending (routine | manager-spawned)`.
- Task 10 will write SETUP §5 for launch mode `routine`, with the `manager-spawned` fallback
  text, marked as to be confirmed by the spike.
- Test command everywhere: `npm test` (the quoted glob); installed script path is
  `.agents/scripts/<module>/`; `check-templates` uses the installed → template mapping from
  the controller session's ruling.
