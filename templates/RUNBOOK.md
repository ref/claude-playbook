# RUNBOOK — the human's page

Everything YOU run, click or must remember to operate this project day to day. Agents keep
this file current: any PR that adds something human-facing (a command, a setting, an env
var, a ritual) must update it, and the PR template's `## Docs` section and the reviewer's
docs-honesty item enforce that. If you catch yourself remembering something this page does
not say, that is a bug in this page: file it.

---

## Daily development

Four touchpoints, and only four: you answer the manager's planning questions, you say
"go", you hand-test, you approve and merge.

- **Picking the model** (the table is in `.agents/routing.md`). The model and effort picker
  sits in the composer next to the send button and remembers your last choice, so the
  normal state is Sonnet 5.5 at medium; switch to think, then switch back:
  - TASK (`/do`, `/review`, `/status`, `/playbook-update`, small fixes): Sonnet 5.5,
    effort medium. The normal state.
  - DISCUSSION (designing a feature, spec and plan, a hard bug): Opus 5.5, effort high.
  - SERIOUS THINKING (architecture, `/audit` of a whole feature, a second opinion): Fable
    5.1, effort high; maximum effort only for an audit.
  - Effort is how long the model thinks per step: medium is normal; high is slower and
    costs roughly 1.5–2×.
- **Starting a task**: type `/do <n>` in a new desktop session, started from this
  repository's Local environment (the Worktree checkbox on), on the task model.
  That session is the manager: it reads `AGENTS.md` and issue #n including its comments,
  decides what the issue needs (a spec and plan first, one question first, or a worker
  right away), and reports back. For substantial work it interviews you, writes the spec and
  the plan, files the sub-issues and gives you a brief of at most 150 words; you reply "go".
  Filing a two-line issue is fine: `/do` grows it when its turn comes.
- **Hand-testing**: the manager tells you `PR #n ready, test: …`. The PR body's
  `## How to test by hand` has at most five steps. Pull the branch locally, or open the
  worktree the app offers.
- **Where are we**: `/status` in any desktop session answers in the chat: feature branches
  against their umbrellas, PRs by stage with their verdicts, open issues.
- **Keeping the playbook current**: `/playbook-update` syncs this repository against the
  playbook (it says "up to date" in seconds when nothing moved); `/playbook-compact`, run
  occasionally, shrinks the accumulated memory files without losing rules. Both show their
  report before writing and land as a normal PR.
- **Where the skills live**: `.agents/skills/<name>/SKILL.md`, ordinary files you may edit.
  `.claude/skills/*` are symlinks to them, because Claude Code reads only there.
- **The local gate** (what CI will run anyway):

      pnpm run format:check && pnpm run type-check && pnpm run lint && pnpm run knip && pnpm run build && pnpm test

- **Dev servers**: only you start and stop them.
- **After a fresh clone**: run `git config core.hooksPath .githooks`. The setting is per
  clone and never committed, so a new clone starts with the pre-push lock disarmed.

## Approving and merging

- Your approving review on GitHub IS the merge decision where the ruleset requires one
  approval (it can only if the PR's author is not your own login; SETUP section 4 says when).
  Where it does not, the merge click is the decision, and agents still never approve or
  merge: that is a rule in `AGENTS.md`, not something GitHub enforces. Merge is squash only,
  by your button or auto-merge.
- Five checks must be green: `checks`, `pr-hygiene`, `security`, `test-integrity`,
  `review-verdict`. The branch must be up to date with the base.
- **What the `review-verdict` status description tells you**:
  - `approve for <sha>`: the executing reviewer approved exactly this head.
  - `approve carried from <sha>`: the head differs from the approved one but its patch
    against the base is identical (an "Update branch" or a rebase), so the earlier approve
    stands. Re-approve on GitHub after the update; you do not need to re-test.
  - `blocker for <sha>`: the reviewer found something; the author is fixing it.
  - `no verdict for <sha>`: no verdict yet for this head. See the next section.
- The reviewer's comment opens with `Reviewed-by: claude/<model>, head <sha>`; read its body
  for the `## Not executed` list: whatever the reviewer could not run is yours to weigh.
- A feature PR adds one rule: never merge it before you have tried the feature branch
  yourself.
- Never merge while "Update branch" is visible without re-approving after it; never merge
  without green checks on the latest commit.

## When a verdict never lands

The reviewer starts by itself on every PR head. If `review-verdict` still reads
`no verdict for <sha>` after a reasonable wait (the routine is a research preview and a
green routine run does not prove a verdict was written):

1. Look at the PR's comments for a verdict from a login listed in `REVIEWER_LOGINS`. A
   comment from anybody else, an edited one, or one not shaped as the grammar requires,
   does not count.
2. Run `/review <n>` yourself in a desktop session. It posts the verdict as a comment (under
   your own login, which must then be in `REVIEWER_LOGINS`); the status re-evaluates on its
   own.
3. If it keeps failing, look at the routine's run history in the app.

## Features that take several PRs (feature branches)

A feature whose pieces are useless until the last one lands grows on `feature/<topic>` and
reaches the trunk, and so the deploy, in ONE PR after you have tried it. Your part:

- **Starting one**: file the issue and `/do <n>`. The manager asks whether the phases land
  on a feature branch (the default) or one by one; it creates `feature/<topic>` and writes
  `Branch: feature/<topic>` into the umbrella. Every sub-issue's PR goes into the feature
  branch; you approve and merge those like any other. Nothing deploys. The sub-issue closes
  and its umbrella line ticks itself on merge.
- **Working on something else meanwhile**: nothing to do. A fix is a normal issue and a
  normal PR into the trunk; the feature branch takes the trunk by merge at the next
  sub-task and before the feature PR.
- **Pausing**: stop starting its sub-issues. The branch waits; the longer the pause, the
  more the next trunk merge has to resolve.
- **Trying it**: when the umbrella's checklist is fully ticked, in your own checkout run
  `git switch feature/<topic>` and click through. A bug is a new issue with
  `Refs #<umbrella>`. Switch back to the trunk when done.
- **Audit** (optional, before releasing): the audit commands arrive in a later milestone of
  the playbook; until then the integration review is the check.
- **Releasing it**: in that checkout, on the feature branch, tell an agent `/ship`. It
  merges the trunk in, runs the gate and opens `feature/<topic>` → trunk with
  `Closes #<umbrella>`; the reviewer runs an integration review. Approve and merge it; GitHub
  deletes the branch.
- **Schema changes never ride the feature branch**: the plan puts each in its own small
  trunk PR. `ship` refuses a schema diff aimed at a feature branch; that is the rule
  working.

## Routing

Which model does which kind of work, and at what effort, is in `.agents/routing.md`; it is
the one file to edit when models change. Child workers run on Sonnet 5.5 at medium unless
the manager states a reason in the brief; subagents are always named explicitly, never
inherited.

## Dependency cooldowns (supply chain)

Nothing may enter this repository until its release has been public for a few days: nearly
every malicious npm release is caught and pulled within 24–72 hours. The policy is 3 days
for minor and patch, 14 days for majors, and it lives in two places because neither half
can do the other's job:

| Layer | Where | What it gates |
| --- | --- | --- |
| Dependabot `cooldown:` | `.github/dependabot.yml` | when a bump PR is even opened |
| Package-manager minimum release age | pnpm's `minimumReleaseAge` | what any local install may resolve to |

- **Security updates bypass the Dependabot cooldown by design.** Confirm they are on: repo
  Settings → Advanced Security → Dependabot security updates. Only you can see that
  checkbox.
- A minimum-release-age setting gates the lockfile too: CI goes red while any entry,
  transitive ones included, is younger than the cutoff. That red is the quarantine working;
  wait it out, or add the exact version to the exclude list for one PR, with a comment
  naming the CVE. An exclude without a removal date is a bug. Never `trustLockfile: true`.

## CI shape (what runs, and what it bills)

- Five required checks, each its own workflow: **CI** (`checks`: format, types, lint, knip,
  build, tests), **PR hygiene** (`pr-hygiene`: title, issue link, template sections),
  **Security** (`security`: gitleaks), **test-integrity** (deleted, skipped or weakened
  tests must be declared) and **review-verdict** (a commit status set from the reviewer's
  comment). Build is a step inside `checks`, not a job of its own: GitHub bills per job
  rounded up to the minute.
- **Feature merge** runs after a merge, not before: it closes the sub-issues a PR into a
  feature branch names and ticks their umbrella lines. It is never a required check.
- **A doc-only PR runs no real CI, on purpose.** `ci.yml` ignores `docs/**`, `**.md` and
  `.claude/**`; its no-op twin reports a green `checks` for exactly those PRs so that a
  required check never hangs. On a PR touching both docs and code, both run; the real one
  lands last and wins. A mixed PR that goes green in seconds is worth one look.
- **Security runs on PRs only.** Every job carries `timeout-minutes`.

## Emergency overrides (yours alone — agents may never use them)

- `ALLOW_DIRECT_PUSH=1 git push …`: a direct push to the trunk past the local hook. The
  ruleset still applies to you unless you put yourself on its bypass list (SETUP section 4).
  Prefer a PR.
- `SKIP_PUSH_GATE=1 git push …`: skip the local static gate.
- Changing a protected path (workflows, `.githooks`, `.agents`, `AGENTS.md`, `CLAUDE.md`,
  `.claude/settings.json`) is a PR you open yourself, or review with particular care when an
  agent opens it: with one identity GitHub cannot refuse the agent's pushes to them, so the
  protection is the rule in `AGENTS.md`, `CODEOWNERS` and the reviewer's gate-integrity
  check.

## When something looks broken

| Symptom | First move |
| --- | --- |
| A doc-only PR's `checks` is instant | That is the no-op twin; `ci.yml` skips `docs/**` and `**.md` by design |
| CI red on `security` | Treat as a real leak until proven otherwise; if real, rotate the credential FIRST |
| CI red on the build step | The author fixes it, never you; it fails before the tests, so it fails cheap |
| `pr-hygiene` red | The title, the issue link or a template section is missing or empty; the author edits the body and it re-runs |
| `test-integrity` red | The diff deletes or skips a test, or removes assertions, and `## Tests changed` does not say why. The author declares it (or restores the test); you decide whether the reason is good |
| `review-verdict` missing or `no verdict for <sha>` | See "When a verdict never lands" |
| `review-verdict` says `repository variable REVIEWER_LOGINS is not set` | Set the repository variable `REVIEWER_LOGINS` to the login the reviewer's verdict comments appear under (SETUP) |
| A merged sub-PR left its issue open or its umbrella line unticked | Open the Feature merge run on that PR: the body had no `Closes #N`, or the umbrella line is not in the `- [ ] #N` form. Fix the line by hand this once |
| A DB-backed test fails in a cloud session with "connection refused" | The database runs only while a session does: the SessionStart hook (`.agents/cloud-session-start.sh`) starts it. Run `service postgresql start` and rerun. Node and pnpm come from the environment's setup script (`/tmp/setup.log` in the session shows what it did) |
| `ship` refused a sub-task for touching the schema | By design: a schema change goes to the trunk as its own small PR, then the task rebases onto it |
| The approve you see was for another sha | `approve carried from <sha>` means identical content; anything else needs a fresh verdict, so wait for the reviewer or run `/review <n>` |
| An agent's push was rejected on a path under `.github/workflows` or `.agents` | Only with the later machine-user setup (a push ruleset): the change is a PR you push yourself |

## Verified

_(empty — the first adoption records here which verification items passed and when.)_
