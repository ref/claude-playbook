# SETUP — the human's one-time configuration

`docs/ADOPT.md` is the agent's page; this one is yours. Sections 1–3 are done once per
machine and account pair; sections 4–7 are done once per repository. `<owner>` and `<repo>`
below are your GitHub login and the repository name.

## 1. Identities

GitHub must be able to tell an agent from you, otherwise the approval rule in section 4 is
not a machine guarantee. There are three identities:

| Role | Who | Used in |
|---|---|---|
| owner | you | your own shell and the GitHub UI, nowhere else |
| agent | a second GitHub account (machine user) | worker cloud environments, the `agent` desktop preset |
| reviewer | a third GitHub account (machine user) | the reviewer cloud environment, the `reviewer` desktop preset |

Create the two machine accounts by hand (account creation is not something an agent does).
Then, for each one, create a fine-grained personal access token scoped to the repositories
that will adopt the playbook:

- **agent** token: Contents write, Pull requests write, Issues write, Metadata read.
- **reviewer** token: Contents read, Pull requests write, Commit statuses write, Issues
  read, Metadata read. It has no push right, so it cannot change the code it reviews.

Invite both accounts to each repository as collaborators with the **Write** role. The
reviewer is not a code owner, so its approving review never satisfies the ruleset.

Token expiry: one year. Put a calendar reminder a month before it.

Why machine users and not GitHub Apps: App tokens expire hourly, while presets and cloud
environments hold long-lived secrets.

## 2. Cloud environments

Per adopting repository, create two Claude cloud environments:

| Environment | Name | Network | Secret |
|---|---|---|---|
| worker | `<repo>-worker` | trusted | the agent token, as a network secret named `GH_TOKEN` |
| reviewer | `<repo>-reviewer` | trusted | the reviewer token, as a network secret named `GH_TOKEN` |

Both use the setup script `templates/cloud-setup.sh` from this repository, adapted per
project (section 6 explains it; the script itself is written in the playbook's Task 10 and
named here only so the environments can reference it).

Cloud sessions reach GitHub through a proxy that blocks GraphQL: `gh pr …` and `gh issue …`
fail there, `gh api` (REST) works. Every playbook skill that may run in the cloud uses
`gh api` only.

## 3. Desktop presets

In the Claude desktop app create two session presets:

| Preset | Carries |
|---|---|
| `agent` | `GH_TOKEN` = the agent token. Every manager and every local worker session uses it. |
| `reviewer` | `GH_TOKEN` = the reviewer token. Used when you run `/review <n>` by hand. |

Your own terminal keeps your own `gh auth` login. Never start a manager or worker session
without the `agent` preset: a PR authored by you could not be approved by you, and the
ruleset would be unsatisfiable.

## 4. The ruleset (per repository)

Do this after adoption, once the workflows have run at least once on a throwaway PR: the
required-checks picker offers only names it has already seen, and GitHub refuses to save
the rule with an empty list. Where a setting has a `gh` form it is given; commands survive
UI redesigns.

**Merge settings** (Settings → General → Pull Requests):

```
gh api -X PATCH repos/{owner}/{repo} \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true -F allow_update_branch=true \
  -F squash_merge_commit_title=PR_TITLE -F squash_merge_commit_message=BLANK
```

Auto-merge may be on (the merge is your button or auto-merge; the approval is the
decision). Also turn on, under Settings → Advanced Security: Dependency graph, Dependabot
alerts, Dependabot security updates (CVE patches bypass the cooldowns on purpose) and
grouped security updates; on a public repository, Secret scanning and Push protection too.

**Branch ruleset** (Settings → Rules → Rulesets → New branch ruleset), in the order of the
form:

- [ ] Ruleset name `protect-default`; Enforcement status **Active** (it ships Disabled).
- [ ] Bypass list: **you** (the Repository admin role). The machine users have the Write
  role and do not bypass. Nothing else.
- [ ] Target branches: Include default branch (not a name pattern).
- [ ] Restrict deletions ✓; Block force pushes ✓.
- [ ] Require a pull request before merging ✓: Required approvals **1**; Dismiss stale pull
  request approvals when new commits are pushed ✓; Require review from Code Owners ✓;
  Allowed merge methods **Squash** only.
- [ ] Require status checks to pass ✓: Require branches to be up to date before merging ✓;
  add `checks`, `pr-hygiene`, `security`, `test-integrity`, `review-verdict`.
  (`review-verdict` is a commit status, the others are check runs; add each by name.)
- [ ] Everything else OFF, Copilot code review included.

`feature/*` branches stay outside this ruleset on purpose: the trunk merge into them and
GitHub's "Update branch" button would both be refused. Their gate is the trunk's, at the
feature PR.

**Push ruleset** (Settings → Rules → Rulesets → New push ruleset), the protected paths:

- [ ] Restrict file paths: `.github/workflows/**`, `.githooks/**`, `.agents/**`,
  `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`.
- [ ] Enforcement **Active**; bypass list: you only.

Push rulesets depend on the account plan. If the option is missing, say so in the adoption
record; the fallback is that `CODEOWNERS` already names you for every path, so a change to
a gate cannot merge without your approval, and the agent's pushes to those paths are caught
by the reviewer's gate-integrity check instead of refused up front.

**Repository variable** `REVIEWER_LOGINS` = the reviewer account's login (several, comma
separated, if you ever have more):

```
gh variable set REVIEWER_LOGINS --body '<reviewer login>'
```

The `review-verdict` workflow ignores every comment whose author is not in this list.

## 5. The reviewer routine

Launch mode: **routine**, to be confirmed by the plumbing spike
(`docs/spikes/2026-10-review-plumbing.md`, its final `Launch mode:` line). Until the spike
has run, treat this section as provisional; if the spike says `manager-spawned`, use the
fallback below instead.

In the Claude app create a routine for the repository:

- Environment: `<repo>-reviewer` (section 2), so the session carries the reviewer token.
- Trigger: a pull request is opened or marked ready for review, and a push lands on an open
  pull request (the `synchronize` event). If the routine UI offers fewer events, the spike
  records which ones; a trigger on open alone is not enough, because every push needs a
  fresh verdict.
- Model and effort: the reviewer row of `.agents/routing.md` (currently Opus 5.5, medium).
- Prompt, literally: "Run `/review <pr>` as `.agents/skills/review/SKILL.md` describes, for
  the pull request this event names."

A routine is a research preview: a green run does not prove a verdict was written. The
`review-verdict` check is what counts, and `docs/RUNBOOK.md` says what to do when it reads
`no verdict`.

**Fallback, launch mode `manager-spawned`**: the manager session starts the reviewer as a
child session per PR head (environment `<repo>-reviewer`, or a local child under the
`reviewer` preset where the cloud cannot build the project), with the same prompt and the
PR number filled in, once when the worker reports the PR and again after every worker push.
After the manager is gone, you run `/review <n>` by hand in a `reviewer`-preset session.

## 6. Cloud environments in detail

Both environments use the repository's setup script. `templates/cloud-setup.sh` is the
starting point: copy it into the environment's setup-script field and adapt it to the
project. It enables corepack, installs with a frozen lockfile, starts the services from
`docker compose` when a compose file exists, and exports the test database URL. It must
finish in under five minutes, or the environment is not cached and every session pays for
it again.

- `<repo>-worker`: the agent token as `GH_TOKEN`, trusted network (package registries and
  GitHub), the setup script.
- `<repo>-reviewer`: the reviewer token as `GH_TOKEN`, the same setup script, so that the
  reviewer can run the gate.

A project the cloud cannot build (memory limits) runs its reviewer as a local child session
instead; the playbook's `review` skill is the same in both.

## 7. The machine

In the Claude desktop app:

- [ ] Worktrees on (one per session).
- [ ] Auto-archive sessions after their PR merges.
- [ ] Branch prefix for session branches: your preference; task branches follow
  `<type>/<short-name>` from `AGENTS.md`.
- [ ] The `agent` and `reviewer` presets from section 3.
- [ ] `git config core.hooksPath .githooks` in every clone (the setting is per clone; the
  verification checklist in `docs/ADOPT.md` checks it).

Desktop mods are your personal choice and are not part of the playbook.
