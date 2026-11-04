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
- **Starting a task**: type `/do <n>` in a new session on the task model: in the desktop
  app, started from this repository's Local environment (the Worktree checkbox on); in
  Orca, in a new worktree of this repository.
  That session is the manager: it reads `AGENTS.md` and issue #n including its comments,
  decides what the issue needs (a spec and plan first, one question first, or a worker
  right away), and reports back. For substantial work it interviews you, writes the spec and
  the plan, files the sub-issues and gives you a brief of at most 150 words; you reply "go".
  Filing a two-line issue is fine: `/do` grows it when its turn comes.
- **Hand-testing**: the manager tells you `PR #n ready, test: …`. The PR body's
  `## How to test by hand` has at most five steps. Pull the branch locally, or open the
  worktree the app offers.
- **Where are we**: `/status` in any local session answers in the chat: feature branches
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
- Three checks must be green: `checks`, `pr-gates`, `review-verdict`. The branch does not
  have to be up to date with the base: merge green PRs in a row, no "Update branch" click.
  Auto-merge ("Allow auto-merge" in the repository settings) is your optional click on a
  PR; agents never enable it.
- After a merge, a red push run on the trunk opens a `master-red` issue and the manager
  fixes it forward; while the trunk is red, no new code PR turns green, and PRs already
  green still merge.
- **What the `review-verdict` status description tells you**:
  - `approve for <sha>`: the executing reviewer approved exactly this head.
  - `approve carried from <sha>`: the head differs from the approved one but its patch
    against the base is identical (an "Update branch" or a rebase), so the earlier approve
    stands. Re-approve on GitHub after the update; you do not need to re-test.
  - `blocker for <sha>`: the reviewer found something; the author is fixing it.
  - `no verdict for <sha>; waiting for the reviewer` (yellow, pending): the reviewer has
    not posted for this head yet; it starts by itself and usually takes a few minutes.
    Still yellow long after that: see the next section.
- The reviewer's comment opens with `Reviewed-by: claude/<model>, head <sha>`; read its body
  for the `## Not executed` list: whatever the reviewer could not run is yours to weigh.
- A feature PR adds one rule: never merge it before you have tried the feature branch
  yourself.
- Never merge without green checks on the latest commit. The ruleset enforces it on the
  trunk; into a feature branch (no ruleset there) this ritual is the only guard.

## When a verdict never lands

The reviewer starts by itself on every PR head. If `review-verdict` still reads
`no verdict for <sha>` after a reasonable wait (the routine is a research preview and a
green routine run does not prove a verdict was written):

1. Look at the PR's comments for a verdict from a login listed in `REVIEWER_LOGINS`. A
   comment from anybody else, an edited one, or one not shaped as the grammar requires,
   does not count.
2. Run `/review <n>` yourself in a fresh local session on the PR's head commit (in Orca, a
   new worktree from the PR's branch; never on the trunk). It posts the verdict as a comment (under
   your own login, which must then be in `REVIEWER_LOGINS`); the status re-evaluates on its
   own.
3. If it keeps failing, look at the routine's run history in the app.

## Features that take several PRs (feature branches — opt-in)

By default the phases of a multi-PR feature land on the trunk one by one. Choose a feature
branch when the pieces are useless until the last one lands, or when the trunk deploys on
every push: then the feature grows on `feature/<topic>` and reaches the trunk in ONE PR
after you have tried it. Your part:

- **Starting one**: file the issue and `/do <n>`. The manager offers the feature branch
  when it applies; on your yes it creates `feature/<topic>` and writes
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

- Three required checks: **CI** (`checks`: gitleaks, format, lint, knip, type-check, the
  playbook script tests, build and the test suite, about two minutes), **pr-gates** (one
  workflow, three steps: pr-hygiene — title, issue link, template sections —,
  test-integrity — deleted, skipped or weakened tests must be declared — and gates-changed
  — a PR touching a protected path needs a non-empty `## Gates changed` section) and
  **review-verdict** (a commit status set from the reviewer's comment). Everything inside
  `checks` is a STEP, not a job of its own: GitHub bills per job rounded up to the minute.
  Where a release workflow runs the build and the browser smoke ("Releasing"), the Build
  step leaves `checks`.
- **CI also runs on every code push to the trunk**, the same `checks` job, so a break that
  two green PRs make together shows up at once. If it fails, a second job opens an issue
  labelled `master-red` (one open at a time); the fix is a PR that closes it. The label
  must exist (`gh label create master-red --color B60205`).
- **pr-gates and review-verdict run the trunk's copy** of their workflow and of
  `.agents/scripts/` (`pull_request_target`, `issue_comment`), never the PR's. A PR that
  changes one of those scripts is checked by the old one until it merges.
- **review-verdict runs only when a verdict comment lands**, never on a push. A head the
  reviewer has not posted for shows the status as "Expected" and cannot be merged; that is
  the lock, not a stuck run.
- **Feature merge** runs after a merge, not before: it closes the sub-issues a PR into a
  feature branch names and ticks their umbrella lines. It is never a required check.
- **A doc-only PR runs `checks` in about a minute, on purpose.** The job always starts on
  a PR, so the required check always reports; its first step lists the changed files and,
  when every one is under `docs/`, a `.md` file or under `.claude/`, skips everything but
  gitleaks. `.agents/`, `.github/`, `.claude/skills/` and `.claude/settings.json` are never
  documentation, even a `.md` there (`.agents/scripts/ci-scope/`); the push trigger on the
  trunk follows the same rule and skips a documentation-only push entirely. There is no
  twin workflow.
- **gitleaks runs on PRs only.** Every job carries `timeout-minutes`.
- Budget: GitHub includes 2 000 Actions minutes a month on a private repository on Free,
  3 000 on Pro; public repositories are free. A code PR push bills ~2–3 minutes and a merge
  ~2; a release bills ~10. Set a spending budget that does not stop usage ("Branch
  protection"), so a busy month bills a few dollars instead of stopping CI.

## Branch protection

The `protect-default` ruleset guards the trunk. Read the live state rather than trusting
the settings page from memory: the ruleset editor needs an explicit **Save changes** click,
and a ticked-but-unsaved checkbox is visually identical to a saved one:

    gh api repos/{owner}/{repo}/rulesets

The configuration, kept here so it can be rebuilt (section 4 of the playbook's SETUP page
has the form, field by field):

- Name `protect-default`, Enforcement status **Active**, Bypass list **empty**.
- Target branches → **Include default branch**.
- Ticked, and nothing else: Restrict deletions · Block force pushes · Require a pull request
  before merging (Allowed merge methods → **Squash** only) · Require status checks to pass,
  with **Require branches to be up to date before merging** UNticked (verify
  `strict_required_status_checks_policy` is `false` in the ruleset dump).
- Repository settings → General → Pull Requests → **Allow auto-merge** ticked (verify
  `gh api repos/{owner}/{repo} --jq .allow_auto_merge` prints `true`).
- Three required checks, copied verbatim; they are matched as literal strings:

      checks
      pr-gates
      review-verdict

- Repository variable `REVIEWER_LOGINS`: the login(s) the reviewer's verdict comments
  appear under (Settings → Secrets and variables → Actions → Variables).
- Settings → Billing → Budgets: an Actions budget that does **not** stop usage, so a month
  over the included minutes never stops CI.

Renaming a CI job silently detaches the lock: the ruleset keeps waiting for the old string,
and a required check nobody reports never goes red, it waits forever with the merge button
down. Any job rename is paired with a ruleset edit. An empty bypass list applies to you
too: no direct pushes to the trunk, which the pre-push hook already enforces locally.

## Smoke (optional)

A browser smoke, where the project has one, runs in the release workflow against the built
image, never on a PR and never in the local gate or the pre-push hook: it needs a build and
a browser, and agent pushes stay fast. A red smoke means the app is broken for a real user:
more serious than a red unit test, not less, and re-running is not a fix (zero retries by
design; a step that only sometimes passes gets stabilised or deleted). A PR that touches a
flow the suite covers may say "covered by smoke" in "How to test by hand". Put the project's
own command to run it here.

## Releasing (where `release.yml` is installed; delete this section otherwise)

A merge to the trunk deploys nothing. You decide when the trunk goes to production: GitHub →
Actions → **Release** → Run workflow on the trunk (leave `version` empty), or
`gh workflow run release.yml --ref <trunk>`. Agents never press it.

- **What it does**: verifies exactly that commit (the whole gate, plus what only a release
  needs), builds the image once, starts it and runs the smoke against it, pushes the image
  to GitHub's container registry as `<number>` and `release`, and creates the tag
  `v<number>` and a GitHub Release whose notes list the PRs merged since the previous
  release. About ten minutes.
- **The number** is the count of commits on the trunk (`git rev-list --count`), so it grows
  by one per merged PR. A commit that already has its release is refused ("Nothing new
  since v…").
- **The run deploys itself.** After the image is pushed, job `deploy` calls the deploy
  webhook, then polls `<site>/api/version` until it answers the new number (5 minutes).
  Only then does it create the tag and the Release. A release with no tag and no Release is
  therefore a release that did not reach the site.
- **Red means different things by where it happened.** In job `verify` (verification,
  build, smoke) or `publish` (the image push) production is untouched. In job `deploy`,
  before the step **Deploy**, it is untouched too (a missing secret, a rollback to a version
  with no image). From **Deploy** on, production may already run the new image with its
  migrations applied: open `<site>/api/version`, read the application's log, and roll back
  if the site is broken. The failing step's error says the same.
- **Rolling back**: Actions → **Release** → Run workflow, `version` = the build number to
  return to (the previous release, or any earlier one; `git tag -l 'v*'` lists them). It
  runs no verification and no build: it points `:release` at that version's image, fires
  the same webhook and waits for that number. Migrations stay additive for exactly this
  reason: the older image boots against the newer schema. Moving forward again is a normal
  release from the trunk, once it has a new commit.
- **The host builds nothing**: it pulls `<image>:release` from the registry. Its own
  rebuild or rollback buttons stay available but move one application alone; prefer the
  workflow.

**One-time setup, before the first release:**

1. The application serves `GET /api/version` as `{"version": …, "sha": …}` from the
   `APP_VERSION` and `GIT_SHA` build args (`dev` outside an image).
2. The host runs the application from the registry image `<image>:release` with a
   read-only registry token, and exposes a deploy webhook (a bodiless POST that makes it
   pull and restart). Put that URL in the repository secret `DEPLOY_WEBHOOK` (Settings →
   Secrets and variables → Actions). One secret and one call per application.
3. Fill the `ADAPT` blocks of `.github/workflows/release.yml`: the image name, the site
   URL, the smoke, the database the verification needs.
4. Settings → Billing → Budgets: an Actions budget that does **not** stop usage.
5. Run the release. The step **Deploy** is green and **Wait for the site** prints
   `The site runs build <number>.` The first release's notes list every PR ever merged
   (there is no previous tag); that is expected.

## Emergency overrides (yours alone — agents may never use them)

- `ALLOW_DIRECT_PUSH=1 git push …`: a direct push to the trunk past the local hook. The
  ruleset still applies to you unless you put yourself on its bypass list (SETUP section 4).
  Prefer a PR.
- `SKIP_PUSH_GATE=1 git push …`: skip the local static gate.
- Changing a protected path (workflows, `.githooks`, `.agents`, `AGENTS.md`, `CLAUDE.md`,
  `.claude/settings.json`) is a PR you open yourself, or review with particular care when an
  agent opens it: with one identity GitHub cannot refuse the agent's pushes to them, so the
  protection is the rule in `AGENTS.md`, `CODEOWNERS`, the reviewer's gate-integrity check
  and the `## Gates changed` section `pr-gates` demands.

## When something looks broken

| Symptom | First move |
| --- | --- |
| A doc-only PR's `checks` takes about a minute | That is the Scope step: every changed file is documentation, so only gitleaks ran. On a PR containing code, open the run and look at the `Scope` step |
| CI red on the gitleaks step | Treat as a real leak until proven otherwise; if real, rotate the credential FIRST |
| CI red on the build step | The author fixes it, never you; it fails before the tests, so it fails cheap |
| A `master-red` issue is open | The push run of `checks` failed on the trunk; every new code PR is red on the same break. Fix forward in a PR that closes the issue; close it yourself if the trunk turned green another way |
| `pr-gates` red on the hygiene step | The title, the issue link or a template section is missing or empty; the author edits the body and it re-runs |
| `pr-gates` red on the integrity step | The diff deletes or skips a test, or removes assertions, and `## Tests changed` does not say why. The author declares it (or restores the test); you decide whether the reason is good |
| `pr-gates` red on the gates-changed step | The PR changes a protected path (a workflow, a hook, `.agents/`, `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, or what `.agents/scripts/gates-changed/protected.json` adds) and has no non-empty `## Gates changed` section. The author explains the change there; you review it with particular care |
| `review-verdict` shows "Expected" and nothing else | The reviewer has not posted for this head yet; the status appears with the verdict. Long after that: see "When a verdict never lands" |
| `review-verdict` missing or `no verdict for <sha>` | See "When a verdict never lands" |
| `review-verdict` says `repository variable REVIEWER_LOGINS is not set` | Set the repository variable `REVIEWER_LOGINS` (see "Branch protection") |
| A merged sub-PR left its issue open or its umbrella line unticked | Open the Feature merge run on that PR: the body had no `Closes #N`, or the umbrella line is not in the `- [ ] #N` form. Fix the line by hand this once |
| A DB-backed test fails in a cloud session with "connection refused" | The database runs only while a session does: the SessionStart hook (`.agents/cloud-session-start.sh`) starts it. Run `service postgresql start` and rerun. Node and pnpm come from the environment's setup script (`/tmp/setup.log` in the session shows what it did) |
| `ship` refused a sub-task for touching the schema | By design: a schema change goes to the trunk as its own small PR, then the task rebases onto it |
| The approve you see was for another sha | `approve carried from <sha>` means identical content; anything else needs a fresh verdict, so wait for the reviewer or run `/review <n>` |
| An agent's push was rejected on a path under `.github/workflows` or `.agents` | Only with the later machine-user setup (a push ruleset): the change is a PR you push yourself |

## Verified

_(empty — the first adoption records here which verification items passed and when.)_
