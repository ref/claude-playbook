# claude-playbook — design (v2 of the agent playbook)

Date: 2026-10-16. Status: approved by the owner on 2026-10-16. Supersedes the v1 playbook
(the public `agent-playbook` repository); v2 lives in this repository, `claude-playbook`.

## 1. Intent

A personal workflow for one developer who designs the software and never reads the code.
Claude Code does the work — a manager session in the Claude desktop app, worker sessions in
the cloud — and GitHub holds the guarantees: CI gates, an executing reviewer in a fresh
session, tests nobody may weaken, evidence in every PR. The human plans in conversation,
approves a short brief, tests by hand, merges.

v1 had the same premise but built its orchestration on cmux and hand-written scripts
(task workspaces, status pills, a dashboard page, a question page, a local reviewer
launcher). The desktop app now provides sessions, per-session worktrees, child sessions
that report to a parent, PR monitoring with auto-fix, cloud sessions and routines, so that
layer is deleted rather than ported. The second change is the reviewer: v1 required a
different model family; the evidence (an ESEM 2026 study of 248k agent PRs, Anthropic's own
SDLC) says the levers that matter are a fresh context and verification by execution, not
vendor diversity. v2 keeps those levers mandatory and makes the other family a manual audit.

## 2. Goals

- One command starts a task; a manager session carries it from issue to merged PRs.
- The human is pulled in at exactly four points: planning questions, "go", hand-test, merge.
- Workers run in Claude cloud sessions by default and in local worktrees as a fallback,
  from the same brief.
- Every PR passes: the CI gate, PR hygiene, security scan, test integrity, and an executing
  review by a fresh Claude session. The ruleset blocks a merge without them.
- The PR body carries evidence (gate output, tests added, screenshots for UI, the
  pre-review summary) so that nobody has to read the diff.
- Feature-level audits are a ritual with a command: the strongest model over a whole
  feature, and a vendor-neutral prompt for any third-party model, with Claude triaging the
  third party's findings by execution.
- Rules and protocols live in the repository in files any agent reads (`AGENTS.md`,
  `.agents/skills/`); orchestration is left to the app.
- Marginal cost beyond the existing subscriptions: $0 by default.

## 3. Non-goals

- Supporting other people's stacks. The stack is hardcoded (section 5). The repository may
  stay public, but nothing is generalized for strangers.
- Terminal multiplexers, dashboards, status pills, custom notification channels.
- Scripts that create, provision or retire worktrees. The app owns worktrees.
- Automatic cross-family review in CI. The reviewer slot in the workflow stays swappable
  (an OpenCode-driven third-party model was researched and costed at $5–9/month), but it is
  not built in v2.
- Stacked PRs, merge queues, batch merging, "red main" strategies.

## 4. Anti-goals (a v2 that does these has failed)

- A guarantee that exists only in a local hook, a laptop script, or an agent's memory.
  Everything that must hold is re-checked on GitHub.
- Orchestration state that exists only inside a session's context. The umbrella issue, the
  PRs and the committed docs are the state; any session can be restarted from them.
- A reviewer that reads without executing, or that is the author's session.
- A ritual the human must remember. Everything the human runs or decides is on one page.
- Playbook machinery that grows back: detection, rendering, per-toolchain branches.

## 5. Constraints

- Stack: pnpm + TypeScript; Rust (Tauri) where a `Cargo.toml` exists; GitHub with `gh`;
  Claude Max (desktop app, cloud sessions, routines); a Google One AI subscription with the
  Antigravity CLI (`agy`) for manual second opinions only.
- Claude cloud environment (per the 2026-10 docs): commands time out at 2 min (10 on
  request) plus 30 in background; large builds may be killed for memory; the GitHub proxy
  blocks GraphQL, so `gh pr …` fails while REST via `gh api` works; repository hooks apply
  only in single-repo sessions; plugins, `~/.claude` and local MCP servers do not carry
  over; an unresumable paused sandbox can lose uncommitted work. Consequences: skills and
  rules are in-repo files, never a plugin; agents commit as they go; PR operations in the
  cloud go through `gh api`.
- The desktop app's "start session in the cloud" ignores model and effort; the worker brief
  sets them itself (`/model`, `/effort`) on its first line.
- Routines are a research preview: a green run does not prove a verdict was written. CI
  checks for the verdict; it never trusts the run.
- Parallel sessions and per-PR reviews consume Max limits proportionally. Routing (section
  6.7) keeps the cheap tiers on the volume work.
- Repository hygiene: if the new playbook repository is public, no private project names,
  personal names, e-mail addresses or local paths may appear in files or commits.

## 6. Decided design

### 6.1 Roles

- **Human (architect).** Files ideas as issues, directly or through a discussion session
  that files them. Answers the manager's questions. Approves the brief. Hand-tests. Merges.
  Runs audits.
- **Manager.** A desktop session in the project, started with `/do <n>`. One per task or
  feature; restartable from the umbrella issue. On substantial work it never writes product
  code: it interviews, writes the spec and the plan, files sub-issues, spawns workers,
  relays blockers, reports. Small work with the decision made it does itself, in place
  (6.2 step 2). At most one recon subagent, only for substantial work, on a cheap model
  named explicitly.
- **Worker.** A fresh session per sub-issue of substantial work — a cloud session by
  default, a local worktree session as fallback — reading only `AGENTS.md`, the spec, the plan and its issue. It
  implements test-first, runs the gate and the pre-review, commits, pushes, opens the PR with
  evidence, fixes review blockers, and reports to the manager in one line.
- **Reviewer.** A fresh Claude session per PR head. Launch: a routine on PR events (the PR
  marked ready for review, and every push to a ready PR); fallback where routines cannot be
  made to fire per event: the manager spawns the reviewer as a child session per PR, and
  after the manager is gone the human runs `/review <n>` by hand. The `/review` skill is
  written for one runtime — GitHub through `gh api` only, no `gh pr` — so the same session
  runs in the cloud or, where the cloud cannot build the project (section 7's Rust spike),
  as a local child session. It verifies by executing — the gate, throwaway probe tests,
  mutation runs — and posts one comment opening with
  `Reviewed-by: claude/<model>, head <sha>`, listing anything it could NOT execute, and
  ending with `VERDICT: approve` or `VERDICT: blocker`. It never pushes, never merges: its
  GitHub identity (6.3) has no push right, so this holds in every runtime without hooks.
- **Auditor.** Manual. `/audit <scope>` runs the strongest model at maximum effort over a
  whole feature in a fresh session; `/audit-external` is a prompt file for any other model;
  `/audit-triage` has Claude confirm or refute an external audit's findings by execution.

### 6.2 The cycle of one task

1. **Idea → issue.** Two lines are a valid issue.
2. **`/do <n>`** in a new desktop session (the manager). The stage gate from v1 stays:
   small work with the decision made → done IN THIS SESSION by the `/do` session itself
   (branch, test-first, gate, `/ship`; no child session, no subagent, no plan, no spec);
   small work resting on an unmade decision → ask first, questions one at a time (the app's
   question dialog), the agreed shape goes into an issue comment, then done in place;
   substantial work (more than one PR, a new subsystem, a schema change, an architectural
   choice) → spec and plan first, and child workers only for it. On a UI or design
   question the manager first asks exactly one question — "Do you want options and a
   mockup first, or should I just do it and you look at the result?" — and draws or lists
   options only when the human wants them; "just do it" means the smallest reasonable
   version. Every option carries its size in plain words, the recommendation is the
   smallest option that satisfies the issue, and the manager says when the human's pick is
   several times larger.
3. **Spec and plan.** Written by the manager, which holds the interview — never delegated.
   Committed in a docs-only PR (`docs/specs/YYYY-MM-DD-<topic>-design.md`,
   `docs/plans/YYYY-MM-DD-<topic>.md`, `Refs #<seed>`), merged by the human (the docs twin
   keeps it green). The plan's phases become sub-issues; the seed becomes the umbrella with a
   `- [ ] #<n> — <title>` checklist; the umbrella gets a `feature/<topic>` branch unless the
   human says phases may ship one by one. v1's rules on decisions (`Open:` lines,
   `SUPERSEDING` comments, evidence classes on claims) carry over unchanged.
   **The human brief**: at most 150 words in the chat, plain words, what changes for the
   user of the product and what the human will be asked to test; a mockup in the artifact
   pane only when the human chose options and a mockup first. The human reads the brief,
   not the spec.
4. **"Go".** The manager spawns workers: one per sub-issue, in parallel where the plan marks
   phases independent, serial otherwise. The brief is a fixed template (section 6.6).
5. **The worker** cuts its branch from the base (trunk or the feature branch), works
   test-first, runs the full gate, runs `/code-review` on its own diff and fixes what it
   finds (the same-family pre-gate; cheap, catches the obvious), and only then opens the
   PR with the template filled (section 6.4) and reports to the manager. No draft PRs: the
   cloud's GitHub proxy has no GraphQL, and a draft cannot be marked ready without it. Every
   GitHub call from a cloud session is `gh api` (REST): creating the PR, commenting,
   setting a status.
6. **The reviewer** runs when the PR opens and on every later push; the `review-verdict`
   status (a commit status, set by the workflow on the head sha, so that it can be
   re-evaluated when the verdict comment lands) passes only when an approve comment by the
   reviewer identity exists for the head sha — or for an earlier sha whose content,
   measured against the base, is identical to the head's (a base-only "Update branch"
   keeps its approve; any content change needs a fresh verdict). A blocker reaches the
   worker through the app's auto-fix of review comments, or the manager relays it.
7. **Acceptance.** The manager tells the human: PR ready, here is what to test by hand (the
   PR body's "How to test by hand", at most five steps). The human tests — the branch pulled
   locally, or a local worktree the app opens — and APPROVES the PR on GitHub. Because the
   PR's author is the agent identity, the owner's approving review is possible and the
   ruleset requires it (6.3): the approval IS the human's merge decision, machine-enforced,
   and the merge itself may be the human's button or auto-merge. The worktree is archived
   by the app.
8. **Repeat** until the umbrella's checklist is ticked. Then `/ship` on the feature branch
   merges the trunk in, runs the gate and opens the feature PR; it gets an integration
   review from the routine; the human runs `/audit` on the feature (section 6.8), tries the
   branch, merges. The feature branch dies on merge; a second wave is a new umbrella.

### 6.3 Guarantees on GitHub

- **Identities (owner to confirm, section 8).** GitHub must be able to tell an agent from
  the owner, or neither of the next two bullets is a machine guarantee. Three identities:
  the OWNER (the human's own shell and the GitHub UI, nowhere else); the AGENT (a machine
  user — a second GitHub account with a fine-grained token: contents write, pull requests
  write — whose token lives in the project's worker cloud environment and in a desktop
  session preset named `agent`, which every manager and local worker session uses); the
  REVIEWER (a third account: contents read, pull requests write for comments, commit
  statuses write; no push, and its approving review never counts because it is not a code
  owner; its token lives in a separate reviewer cloud environment and in a `reviewer`
  preset). Machine users rather than GitHub Apps because App tokens expire hourly while
  presets and environments hold long-lived secrets. The owner decided for the identities
  (section 8); the fallback without them would have been v1's position — gate files
  guarded by prose, the verdict's author unverifiable.
- **Decision 2026-10-16: deferred.** The owner chose no separate GitHub identities for now:
  everything runs under the owner's own account locally and under the Claude GitHub App in
  the cloud, with one cloud environment per repository and no tokens. The three
  identity-based guarantees above become rules in `AGENTS.md` until the owner revisits:
  (1) the approval rule holds only if GitHub treats the cloud PR's author as someone other
  than the owner, so Required approvals is 1 if the first spike shows that and 0 otherwise
  (Require review from Code Owners only together with 1); (2) the verdict's authenticity
  rests on `REVIEWER_LOGINS` naming the login the reviewer's comments appear under, and
  that login may equal the worker's; edited comments are ignored and the reviewer never
  edits, but authorship is a rule rather than a guarantee; (3) the protected paths cannot
  be a push ruleset that singles out the agent, so they are prose plus `CODEOWNERS` and the
  reviewer's gate-integrity check. The first spike observation (the login a cloud push and
  a cloud comment appear under) decides (1) and (2). The identity design above stays as the
  path back; `docs/SETUP.md` keeps its instructions under "Later".
- **Ruleset on the trunk**: PR required; one approving review required, from a code owner
  (`CODEOWNERS` names the owner for `*`), stale approvals dismissed on push — this is the
  human merge as a machine rule, possible only because PRs are authored by the agent
  identity; required status checks `checks` (or its docs twin), `pr-hygiene`, `security`,
  `test-integrity`, `review-verdict`; branches must be up to date before merging (the
  stale-squash hazard is real and no human watches "Update branch" anymore; the
  carried-over approve in 6.2 step 6 keeps this from costing a re-review per sibling
  merge, and the owner's re-approval after a base-only update is one click with no
  re-test); squash only; no force push; no deletion. Feature branches stay unprotected on
  purpose (v1's reasoning: the trunk merge into them must not be refused).
- **Protected paths** (push ruleset, "restrict file paths"; availability depends on the
  account plan — confirm on the first adopter): `.github/workflows/**`, `.githooks/**`,
  `.agents/**`, `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`. Bypass list: the owner
  only. The agent identity's pushes touching them are refused by GitHub; changing a gate is
  a PR the human pushes from their own shell.
- **Workflows**: `ci.yml` (format, types, lint, knip, build, tests; a Rust job where
  `Cargo.toml` exists), `ci-docs.yml` (the no-op twin), `pr-hygiene.yml` (conventional
  title, issue link, `## Docs`, `## Evidence` and `## How to test by hand` present and
  non-empty), `security.yml` (gitleaks, cargo audit where Rust), `feature-merge.yml` (closes
  sub-issues and ticks the umbrella on a merge into a feature branch), `test-integrity.yml`
  (fails when the diff deletes a test file, adds `.skip`/`.only`/`xit`, or removes
  assertions, unless the PR body declares it under `## Tests changed`), and
  `review-verdict.yml` (reads the PR comments through the API, passes only for an approve
  verdict naming the head sha).
- **Dependabot** with v1's cooldown policy. **Pre-push hook** blocking direct pushes to the
  trunk and running the static gate: a local convenience; the ruleset is the law.

### 6.4 The PR body

Template sections, all machine-checked for presence: the issue link (`Closes #n` /
`Refs #n`), `## What changed` (three lines), `## How to test by hand` (at most five steps,
the only section the human reads before testing), `## Evidence` (the gate's final lines,
the tests added by name, screenshots for UI, the pre-review's summary), `## Tests changed`
(`none`, or every deleted, skipped or weakened test with the reason), `## Docs`
(`* <file> — <what>` bullets or `Docs: none — <reason>`), `## Risk nearby`.

### 6.5 Repository layout in an adopted project

```
AGENTS.md                      the rules; one canonical file
CLAUDE.md                      "@AGENTS.md" plus Claude-only lines
docs/RUNBOOK.md                the human's page: what YOU run, decide, remember
docs/specs/, docs/plans/       committed design artifacts
.github/workflows/             ci, ci-docs, pr-hygiene, security, feature-merge,
                               test-integrity, review-verdict
.github/dependabot.yml
.github/pull_request_template.md
.githooks/pre-push
.claude/settings.json          no attribution trailers; permission allow rules
.claude/skills/<name>          symlinks into .agents/skills (Claude reads only here)
.agents/skills/<name>/SKILL.md do, ship, review, audit, audit-external, audit-triage,
                               status, playbook-update, playbook-compact
.agents/playbook.lock          which playbook commit this repo is synced to
.worktreeinclude               gitignored files the app copies into worktrees
.gitignore                     adds .claude/worktrees/
```

Removed relative to v1: `cmux/`, `task-status*`, `dashboard*`, `ask*`, the worktree
scripts, `auto-review.sh`, the `agy/` hook guard and allowlist, the `dashboard` skill.
Carried over as optional: the schema-lock check and the shared-DB rules, for projects with
one dev database.

### 6.6 The worker brief (template, location-agnostic)

First line: `/model <tier>` and `/effort <level>` from the routing table. Then: the
repository and base branch; the issue number; the paths of the spec and the plan; the phase;
the definition of done (PR open, gate green, pre-review done, evidence filled, reported);
the rules pointer (`AGENTS.md`); the scope cap (the smallest change that satisfies the
issue; no refactors; no tests beyond the behavior changed; no tooling set up to produce
evidence; no subagents; model Sonnet 5.5 at medium unless the manager states a reason; if
more seems needed, stop and report instead of widening); what is out of scope; how to
report (one line to the manager: PR number, state, anything blocking). Identical for a
cloud session and a local worktree session; only the launch differs.

### 6.7 Model routing (decided 2026-10-17, after the first real task)

The model follows the kind of work, in three lines the human can remember:

| Kind of work | Tier | Effort |
|---|---|---|
| Task: `/do`, `/review`, `/status`, `/playbook-update`, small fixes | cheap | medium |
| Discussion: designing a feature, spec and plan, a hard bug | middle | high |
| Serious thinking: architecture, `/audit` of a whole feature, a second opinion | strongest available | high; maximum only for an audit |
| Child worker | cheap | medium |
| Subagent inside any session | the cheapest tier that does the job, named explicitly, never inherited | — |
| Reviewer routine | cheap | medium |

Effort is how long the model thinks per step: medium is normal; high is slower and costs
roughly 1.5–2×. The desktop app gets three presets (`task`, `talk`, `think`, `docs/SETUP.md`
section 7) so the human never picks a model by hand. The manager may raise a worker's tier
with a reason in the brief; it does not lower one.

Hard rule: the reviewer is never the authoring session. Concrete model names live in
`.agents/routing.md`, the single table the other texts point at, updated as models change;
`AGENTS.md` carries only the principles.

### 6.8 Audits

- **`/audit <scope>`**: scope is a feature branch, an umbrella issue, or "the last N merged
  PRs". A fresh session on the strongest tier builds, runs the gate, reads the spec against
  the code, writes throwaway probes for the seams between PRs, and looks for what the
  per-PR cycle cannot see: duplicated logic, dead code, missing tests for cross-phase
  behavior, security smells, drift between docs and behavior. Output: findings with
  reproduction steps and an evidence class, filed as issues, plus one summary comment on
  the umbrella.
- **`/audit-external`**: a vendor-neutral prompt file (`.agents/audit-external-prompt.md`)
  the human pastes into any model or CLI (`agy` included). Same protocol, same output
  shape: a numbered list of findings, each with a reproduction step, so that it can be
  triaged mechanically.
- **`/audit-triage <findings>`**: Claude, in a fresh session, reproduces each external
  finding by execution; confirmed ones become issues, refuted ones are recorded with the
  evidence. The third party's opinion is input, never a verdict.

### 6.9 Human-facing surfaces

- The brief, the question dialog with buttons, mockups in the artifact pane, the manager's
  task list and next-step box, the app's PR pane (checks, review state, merge).
- `/status`: "where are we" in the chat — feature branches against umbrellas, PRs by stage
  with their verdicts, open issues — read live from `gh`, no page, no loop.
- Notifications are the app's own. Nothing custom.

### 6.10 The playbook repository (v2)

- `templates/` holds the files of 6.5 with the stack hardcoded; the only placeholder is the
  default branch name. Rust fragments are included where a `Cargo.toml` exists, nothing
  else is conditional.
- `docs/SETUP.md`: the GitHub side (ruleset with required checks and protected paths,
  squash-only, Dependabot security updates), the reviewer routine (trigger on PR events,
  prompt "run `/review <pr>`", model, effort), the cloud environment per project (setup
  script with pnpm, cargo, a test database), the machine (desktop app settings, worktree
  options, the `agent` and `reviewer` session presets). Desktop mods are the owner's
  personal choice and are not part of the playbook.
- `docs/ADOPT.md`: the instruction an agent follows to install into a project (a document,
  not a skill — a skill cannot be invoked before it is installed): Rule 0 from v1, never
  overwrite without showing the diff; it also removes v1's deleted files from a repo that
  had v1. Installed skills: `playbook-update` (sync against `.agents/playbook.lock`) and
  `playbook-compact`.
- No scripts except `test-integrity` and the optional schema-lock, carried from v1.

## 7. Left to the builder

- Routine mechanics: which PR events trigger it, how the session learns the PR number and
  the head sha, and how it posts the comment and a commit status from the cloud
  (`gh api`, REST only). Verify on one real PR before building the rest.
- `review-verdict.yml`: the exact comment grammar, the author check against the reviewer
  identity, and the content-identity test that carries an approve across a base-only
  update (patch-id of the diff against the merge base, or equivalent).
- Identity plumbing: which actor a cloud session's push and `gh api` calls run as; whether
  a cloud environment can hold a token as a network secret and `gh` picks it up; desktop
  presets carrying `GH_TOKEN`. Part of the first spike.
- `test-integrity.yml`: the heuristics (deleted test files, skip/only markers, assertion
  counts) and the declaration heading; keep it a small script with its own tests.
- The `/do` stage-gate text: port v1's `do` skill minus cmux, the page, and worktree
  scripts; add spawning (the app's start-session with the brief), the routing table, the
  human brief, and the restart-from-umbrella path.
- `/ship`: port v1's minus the reviewer launcher; add the Evidence section fill and the
  pre-review step.
- `/review`: the executing protocol from v1's review skill, re-targeted at a Claude cloud
  session with REST-only GitHub access; the verdict grammar.
- The audit skills and the external prompt file.
- `AGENTS.md` v2 wording: v1's rules minus the deleted modules, plus evidence, pre-review,
  protected paths, audits, cloud constraints (commit as you go, `gh api`).
- `docs/RUNBOOK.md` v2: the four human touchpoints, the routing table with current model
  names, the audit ritual, the merge ritual, "when something looks broken".
- `.worktreeinclude` and the cloud setup script per project.
- The first milestone's order: spike the routine-driven review and the identities on one
  PR; spike one cloud worker on a Rust/Tauri project (build within limits? if not, that
  project's reviewer runs as a local child session, 6.1); then the templates; then adopt
  into one project.

## 8. Owner's decisions (2026-10-16)

- **Identities**: yes — the agent and the reviewer get their own GitHub identities (6.3).
  *Superseded the same day:* no separate identities for now; one login locally, the Claude
  GitHub App in the cloud, the guarantees as rules until revisited (6.3, "Decision
  2026-10-16: deferred").
- **Repository**: a new public repository, `claude-playbook`, separate from the owner's
  general Claude-notes repository. Separate because the adopt and update skills pin a
  playbook COMMIT in `.agents/playbook.lock`, which only means something when every commit
  in the repository is a playbook change; and because its `templates/` are copied into
  projects verbatim, so the repository must stay free of anything private, which a
  general notes repository cannot promise. Public because cloud sessions clone it without
  credentials and nothing private may live in it anyway. (Recommendation accepted by the
  owner, who had no preference.)
- **First adopter**: a private TypeScript web application with Docker, no Rust. The
  Rust/Tauri cloud-build spike therefore leaves the first milestone's critical path and
  runs when the second project is adopted. The first adopter's cloud environment needs its
  Docker services (database) in the setup script — builder's item, section 7.

### Decision 2026-10-17, after the first real task

The first task in an adopted project turned a one-line layout change into a process: a recon
subagent, mockups and three questions nobody asked for, a worker in its own session that
added width measurement, a portal, fifteen tests, headless-browser screenshots and a
performance investigation, with the manager and a subagent on the most expensive model. The
owner decided, and the texts now say:

- **Model rule (6.7):** the model follows the kind of work — task on Sonnet 5.5 at medium,
  discussion on Opus 5.5 at high, serious thinking on Fable 5.1 at high (maximum only for an
  audit); child workers on Sonnet 5.5 at medium; subagents named explicitly, never
  inherited. Three desktop presets (`task`, `talk`, `think`) replace picking by hand.
- **Small tasks in place (6.1, 6.2):** small work with the decision made is done by the
  `/do` session itself, with no child session, no subagent, no plan and no spec. Child
  workers only for substantial work; at most one recon subagent, only there, on a cheap
  named model.
- **Ask before mockups and options (6.2):** exactly one question first — options and a
  mockup, or just do it and look at the result.
- **Options with their cost (6.2):** every option carries its size; the recommendation is
  the smallest that satisfies the issue; a pick several times larger is called out.
- **Worker scope cap (6.6):** the smallest change, no refactors, no extra tests, no
  evidence tooling, no subagents, stop and report instead of widening.
- **Screenshots optional (6.4):** only when cheap with tooling the project already has;
  otherwise "How to test by hand" is the evidence for UI.
- **A nudge:** a `/do` session on Opus or Fable facing a small, decided task says so in one
  line and continues.
