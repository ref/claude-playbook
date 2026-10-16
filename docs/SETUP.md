# SETUP — the human's one-time configuration

`docs/ADOPT.md` is the agent's page; this one is yours. Sections 1–3 are done once per
machine; sections 4–7 are done once per repository. `<owner>` and `<repo>` below are your
GitHub login and the repository name.

## 1. Identities: one, for now

Decision 2026-10-16: no separate GitHub accounts yet. Everything runs under your own
account locally (your own `gh auth`) and under the Claude GitHub App in the cloud. There are
no machine users and no tokens to create.

What this costs, honestly. The design (spec 6.3) wanted GitHub to tell an agent from you, and
without that three guarantees become rules in `AGENTS.md` instead of machine guarantees:

- **The approval rule.** If the agent's PRs are authored by your login, GitHub does not let
  you approve them. Whether it works depends on the login a cloud push and a cloud PR appear
  under; the plumbing spike records it (`docs/spikes/2026-10-review-plumbing.md`, first
  observation) and section 4 says what to set.
- **Verdict authenticity.** `review-verdict` trusts comments by the logins in
  `REVIEWER_LOGINS`. If the reviewer comments under the same login as the worker, any
  session that login runs could write a verdict-shaped comment. Edited comments are ignored
  and the reviewer never edits, but authorship is a rule, not a guarantee, until the logins
  differ. The `## Not executed` list in the verdict and your own approval are the backstop.
- **Protected paths.** No push ruleset can single out the agent (section 4), so "agents do
  not change gates" is prose in `AGENTS.md`, backed by `CODEOWNERS` and the reviewer's
  gate-integrity check.

### Later, if you want the guarantees back

Three identities: you (your shell and the GitHub UI), an agent account and a reviewer
account, each a separate GitHub account (a machine user). Create them by hand (account
creation is not something an agent does), then for each create a fine-grained personal
access token scoped to the repositories that adopt the playbook:

| Role | Who | Used in |
|---|---|---|
| owner | you | your own shell and the GitHub UI, nowhere else |
| agent | a second GitHub account | worker cloud environment, the `agent` desktop preset |
| reviewer | a third GitHub account | the reviewer cloud environment, the `reviewer` desktop preset |

- **agent** token: Contents write, Pull requests write, Issues write, Metadata read.
- **reviewer** token: Contents read, Pull requests write, Commit statuses write, Issues
  read, Metadata read. It has no push right, so it cannot change the code it reviews.
  Commit statuses write is needed only for the plumbing spike; the `review-verdict`
  workflow sets the real status with the Actions token. Once the spike has run, drop that
  permission: the reviewer runs the PR's code (the gate, probes), and a token that can set
  statuses is one a malicious PR could use to fake the check.

Invite both accounts to each repository as collaborators with the **Write** role. The
reviewer is not a code owner, so its approving review never satisfies the ruleset. Token
expiry: one year, with a calendar reminder a month before. Why machine users and not GitHub
Apps: App tokens expire hourly, while presets and cloud environments hold long-lived
secrets. The changes this path needs elsewhere are marked "later" in sections 2–4 and 7.

## 2. Cloud environment

Per adopting repository, create one Claude cloud environment named `<repo>`: trusted
network (package registries and GitHub), the setup script of section 6. The Claude GitHub
App authenticates GitHub access; there is no `GH_TOKEN` secret. The worker sessions and the
reviewer routine use the same environment.

Cloud sessions reach GitHub through a proxy that blocks GraphQL: the pull-request and issue
subcommands of `gh` fail there, `gh api` (REST) works. Every playbook skill that may run in
the cloud uses `gh api` only.

*Later (machine users):* two environments instead, `<repo>-worker` with the agent token and
`<repo>-reviewer` with the reviewer token, each as a network secret named `GH_TOKEN`, both
with the same setup script.

## 3. Desktop

Nothing to configure: sessions use your own `gh auth` login.

*Later (machine users):* two session presets, `agent` (`GH_TOKEN` = the agent token; every
manager and local worker session uses it) and `reviewer` (`GH_TOKEN` = the reviewer token;
used when you run `/review <n>` by hand). Never start a manager or worker session without
the `agent` preset: a PR authored by you could not be approved by you.

## 4. The ruleset (per repository)

The order matters, because `pr-hygiene`, `test-integrity` and `review-verdict` trigger on
`pull_request_target` (`review-verdict` also on `issue_comment`): GitHub runs those workflow
files, and the scripts they call, from the DEFAULT branch. On the adoption PR itself they do
not run at all (no red, no report), and until the adoption PR has merged they do not exist
there. So:

1. **Before merging the adoption PR**, if an active ruleset already requires v1's check names
   (`checks (type-check, lint, build, test)`, `gitleaks (secret scan)`,
   `PR body & title hygiene`), edit it to require only `checks` and `security`. The v1 names
   never report any more, so the PR could not be merged otherwise. Keep enforcement Active;
   a temporary Repository-admin bypass is the alternative. A repository with no ruleset yet
   skips this step.
2. Merge the adoption PR (`checks` and `security` are the two that report on it).
3. Set the repository variable `REVIEWER_LOGINS` (below).
4. Open a throwaway PR with a code change, so that all five contexts report at least once:
   the required-checks picker offers only names it has already seen, and GitHub refuses to
   save the rule with an empty list. Close it unmerged.
5. Edit (or create) the ruleset to require all five: `checks`, `pr-hygiene`, `security`,
   `test-integrity`, `review-verdict`.

Where a setting has a `gh` form it is given; commands survive UI redesigns.

**Merge settings** (Settings → General → Pull Requests):

```
gh api -X PATCH repos/{owner}/{repo} \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true -F allow_update_branch=true \
  -F squash_merge_commit_title=PR_TITLE -F squash_merge_commit_message=BLANK
```

Auto-merge may be on (the merge is your button or auto-merge; the approval, where GitHub
allows one, is the decision). Also turn on, under Settings → Advanced Security: Dependency
graph, Dependabot alerts, Dependabot security updates (CVE patches bypass the cooldowns on
purpose) and grouped security updates; on a public repository, Secret scanning and Push
protection too.

**Branch ruleset** (Settings → Rules → Rulesets → New branch ruleset), in the order of the
form:

- [ ] Ruleset name `protect-default`; Enforcement status **Active** (it ships Disabled).
- [ ] Bypass list: may stay empty. (You are the only writer under one identity; add
  yourself, the Repository admin role, if you want emergency pushes.)
- [ ] Target branches: Include default branch (not a name pattern).
- [ ] Restrict deletions ✓; Block force pushes ✓.
- [ ] Require a pull request before merging ✓: Required approvals **1 if the spike shows
  that PR authors are not your login, otherwise 0**; Dismiss stale pull request approvals
  when new commits are pushed ✓ (only meaningful with 1); Require review from Code Owners
  ✓ **only together with 1**; Allowed merge methods **Squash** only.
- [ ] Require status checks to pass ✓: Require branches to be up to date before merging ✓;
  add `checks`, `pr-hygiene`, `security`, `test-integrity`, `review-verdict`.
  (`review-verdict` is a commit status, the others are check runs; add each by name. Where
  the picker offers a source for a required check, choose GitHub Actions for all five, so
  that a status of the same name set by another token does not satisfy the rule.)
- [ ] Everything else OFF, Copilot code review included.

`feature/*` branches stay outside this ruleset on purpose: the trunk merge into them and
GitHub's "Update branch" button would both be refused. Their gate is the trunk's, at the
feature PR.

**Repository variable** `REVIEWER_LOGINS` = the login the reviewer's verdict comments appear
under (several, comma separated, if there are more). The spike records it for the routine;
for a `/review` run by hand it is your own login.

```
gh variable set REVIEWER_LOGINS --body '<login the verdict comments appear under>'
```

The `review-verdict` workflow ignores every comment whose author is not in this list. With
one identity the list is, in effect, "comments by this account", so see section 1 for what
that does and does not guarantee.

*Later (machine users):* a push ruleset (Settings → Rules → Rulesets → New push ruleset)
for the protected paths: Restrict file paths `.github/workflows/**`, `.githooks/**`,
`.agents/**`, `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`; Enforcement **Active**;
bypass list: you only. Required approvals **1** with Code Owners then always works, because
the agent account is not a code owner. Push rulesets depend on the account plan; if the
option is missing, the fallback is that `CODEOWNERS` already names you for every path and
the reviewer's gate-integrity check catches edits to a gate.

## 5. The reviewer routine

Launch mode: **routine**, to be confirmed by the plumbing spike
(`docs/spikes/2026-10-review-plumbing.md`, its final `Launch mode:` line). Until the spike
has run, treat this section as provisional; if the spike says `manager-spawned`, use the
fallback below instead.

In the Claude app create a routine for the repository:

- Environment: `<repo>` (section 2), the same as the workers use.
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
child session per PR head (the cloud environment `<repo>`, or a local child session where
the cloud cannot build the project), with the same prompt and the PR number filled in, once
when the worker reports the PR and again after every worker push. After the manager is
gone, you run `/review <n>` by hand.

## 6. Cloud environment in detail

The environment uses the repository's setup script. `templates/cloud-setup.sh` is the
starting point: copy it into the environment's setup-script field and adapt it to the
project. It enables corepack, installs with a frozen lockfile, starts the services from
`docker compose` when a compose file exists, and exports the test database URL. It must
finish in under five minutes, or the environment is not cached and every session pays for
it again. One environment serves workers and the reviewer, so the reviewer can run the gate.

A project the cloud cannot build (memory limits) runs its reviewer as a local child session
instead; the playbook's `review` skill is the same in both. *Later (machine users):* see
section 2 for the two-environment variant.

## 7. The machine

In the Claude desktop app:

- [ ] Worktrees on (one per session).
- [ ] Auto-archive sessions after their PR merges.
- [ ] Branch prefix for session branches: your preference; task branches follow
  `<type>/<short-name>` from `AGENTS.md`.
- [ ] `git config core.hooksPath .githooks` in every clone (the setting is per clone; the
  verification checklist in `docs/ADOPT.md` checks it).

*Later (machine users):* the `agent` and `reviewer` presets of section 3.

Desktop mods are your personal choice and are not part of the playbook.
