# ADOPT.md — how an agent installs this workflow

You are an agent, installing the claude-playbook workflow into the repository you are
currently in. This page is a document you follow, not a skill: a skill cannot be invoked
before it is installed. Fetch the templates with a shallow clone into a temporary directory
(delete it when done), using the repository address the human named when they sent you here:

    git clone --depth 1 <playbook url> <tmpdir>

If the current directory is not a git repository, stop and say so. The human has set up the
accounts and tokens of `docs/SETUP.md` §1–§3 once; this page installs the files, and
`docs/SETUP.md` §4–§7 is their part afterwards.

This page gives you GOALS and BOUNDARIES, not a script. Handle the unforeseen with judgment
(an odd toolchain, a file that does not fit the table) and say what you found and what you
chose. Where a choice is genuinely the human's (it costs money, deletes something, changes
their habits), ask. Report what you detected before writing anything.

## Rule 0 — existing files are the human's, not yours

Outranks everything below. **Never overwrite an existing file or setting without showing the
exact diff and getting a yes**, one file at a time. A destination that does not exist yet
you may write freely. Two standing cases:

- An existing `.claude/settings.json` is MERGED, never replaced: the template owns only the
  `attribution` keys and the `Bash(node .agents/scripts/*:*)` allow rule; the repository's
  own settings and hooks beside them are untouched.
- An occupied `core.hooksPath` (husky, lefthook) is never re-pointed: offer chaining
  (`sh .githooks/pre-push "$@" < /dev/stdin`) or moving the hook into their directory, and
  say plainly that until resolved nothing blocks a direct push locally.

## What to install

The stack is hardcoded: pnpm, TypeScript, GitHub, Claude Code. A repository on another
toolchain is out of scope: say so and stop.

| Template | Destination |
| --- | --- |
| `AGENTS.md` | `AGENTS.md` |
| `CLAUDE.md` | `CLAUDE.md` |
| `RUNBOOK.md` | `docs/RUNBOOK.md` |
| `agents/routing.md`, `agents/worker-brief.md` | `.agents/routing.md`, `.agents/worker-brief.md` |
| `skills/<name>/SKILL.md` for `do`, `ship`, `review`, `status`, `playbook-update`, `playbook-compact` | `.agents/skills/<name>/SKILL.md` |
| `scripts/review-verdict/`, `scripts/test-integrity/`, `scripts/pr-hygiene/` (every file, tests included) | `.agents/scripts/<module>/` |
| `workflows/ci.yml`, `ci-docs.yml`, `pr-hygiene.yml`, `security.yml`, `feature-merge.yml`, `test-integrity.yml`, `review-verdict.yml` | `.github/workflows/` |
| `pull_request_template.md`, `dependabot.yml` | `.github/` |
| `githooks/pre-push` | `.githooks/pre-push` (executable) |
| `settings.json` | `.claude/settings.json` (merge, Rule 0) |
| `worktreeinclude` | `.worktreeinclude` |

Not installed: the playbook's own `scripts/smoke.test.mjs`, `scripts/check-templates*` and
`cloud-setup.sh` (the latter is pasted into the cloud environments by the human, SETUP §6;
show them the project-adapted version at the end).

Also write:

- `.github/CODEOWNERS` with the single line `* @<login>`, `<login>` from
  `gh api user --jq .login` (the human's own login: confirm it before writing).
- Relative symlinks, so that Claude Code finds the skills: for each installed skill,
  `.claude/skills/<name>` → `../../.agents/skills/<name>`. A real directory already there
  is Rule 0 territory.
- `.gitignore` lines `.claude/worktrees/` and `tmp/` (the reviewer's probe directory), each
  only if missing.
- `.agents/playbook.lock`:

      # claude-playbook sync state — machine-written by the playbook-update and
      # playbook-compact skills; do not edit by hand.
      commit <the clone's HEAD sha>
      synced <YYYY-MM-DD>
      source <the playbook url you cloned>

## Detect and render

- **Default branch**: `gh api repos/{owner}/{repo} --jq .default_branch`. It replaces
  `{{DEFAULT_BRANCH}}` in `ci.yml`, `.githooks/pre-push`, `AGENTS.md`. That is the only
  placeholder.
- **Gate scripts**: `ci.yml` and the gate line in `AGENTS.md` and `docs/RUNBOOK.md` name
  `format:check`, `type-check`, `lint`, `knip`, `build` and `test`. Keep only the steps whose
  `package.json` scripts exist; a step calling a missing script is a hard CI failure on the
  first run. Delete, do not soften with `--if-present`: a tolerant step is green while
  checking nothing. Apply the same deletions to the gate line in `AGENTS.md` and
  `docs/RUNBOOK.md`. Where a gate tool is missing, offer to add it; never invent a script.
  The `checks` job id stays `checks` in both `ci.yml` and `ci-docs.yml`, and `ci-docs.yml`'s
  `paths:` stays the exact inverse of `ci.yml`'s `paths-ignore:`.
- **Tests**: no test script at all → drop the test step, mark the gate line aspirational and
  say so plainly. Never write a fake passing command.
- **Node**: `ci.yml` reads `.nvmrc`; create one from the local `node -v` major if absent.
- **Build-time env**: run the build with every `.env.example` variable set to empty. A
  failure naming a variable gets an obviously fake dummy value in the Build step's `env:`; a
  green build needs nothing. Do this before the human's first PR: a red first run reads as
  "the setup is broken".
- **Database in tests**: on evidence (a compose file, `DATABASE_URL` in `.env.example`, a
  driver dependency), report it and ask; yes → a `services:` block with a health check in
  `ci.yml` and a job-level `DATABASE_URL`, and the project-adapted `cloud-setup.sh`.

## Remove v1

If the repository carries the v1 playbook, list these paths as found, show each, and delete
only what the human confirms, one by one:

- `.cmux/`
- `.agents/task-status*`, `.agents/dashboard*`, `.agents/ask*`
- `.agents/auto-review.sh`, `.agents/guard-reviewer.sh`, `.agents/hooks.json`
- `scripts/*-task.mts` and `scripts/*worktree*.mts` (and their tests)
- the task-status hooks in `.claude/settings.json` (remove only those entries; Rule 0 for
  the rest of the file)
- the `dashboard` skill (`.agents/skills/dashboard/` and its `.claude/skills/dashboard`
  symlink)

Anything else v1 installed that the table above replaces is overwritten only under Rule 0.

## Arm the hook, offer the settings

- `core.hooksPath` unset and no live hooks in `.git/hooks` →
  `git config core.hooksPath .githooks`, and offer
  `"prepare": "git config core.hooksPath .githooks"` in `package.json` (the setting is per
  clone and never committed). Occupied → Rule 0.
- Offer squash-only merges and the rest of `docs/SETUP.md` §4's merge settings.
- A `Dockerfile` in the repository → offer a `docker` entry in `.github/dependabot.yml` in
  the shape of the other two (weekly, the same cooldowns, label `docker`).
- Offer pnpm's `minimumReleaseAge: 4320` in `pnpm-workspace.yaml` (pnpm 10.16+; older → say
  so). Name the cost in the offer: pnpm verifies lockfile entries too, so CI fails while any
  entry, a transitive included, is younger than the cutoff. The remedies are waiting or an
  exclude entry with a reason; never `trustLockfile: true`.

Then point the human at `docs/SETUP.md` §4–§7: the ruleset (it needs one CI run first), the
`REVIEWER_LOGINS` variable, the reviewer routine, the cloud environments, the machine. Do
not restate its contents.

## Verify the installation (re-run any time as a health check)

One line per check: `PASS`, `FAIL` or `SKIP <reason>`, printed verbatim, never summarized to
"all good". A SKIP is not a pass.

1. The six skills are regular files under `.agents/skills/`, and each `.claude/skills/<name>`
   is a symlink that resolves. A real directory there = FAIL (a second copy drifts).
   `.agents/playbook.lock` exists and its `commit` matches the clone's HEAD.
2. `grep -rnE '\{\{[A-Z_][A-Z0-9_]*\}\}' AGENTS.md CLAUDE.md docs .agents .github .githooks`
   prints nothing; any hit = FAIL. (The `${{ … }}` of workflow expressions has spaces and
   does not match.)
3. The hook is armed (`core.hooksPath` = `.githooks`, or the documented chain) and actually
   blocks, tested the way git runs it; exit 0 = FAIL:

       printf 'refs/heads/probe %s refs/heads/<default-branch> %s\n' \
         1111111111111111111111111111111111111111 \
         0000000000000000000000000000000000000000 \
         | SKIP_PUSH_GATE=1 sh .githooks/pre-push origin no-such-remote

4. `ci.yml`'s steps match `package.json`'s gate scripts in BOTH directions, `ci-docs.yml`'s
   job id is `checks` like `ci.yml`'s and its `paths:` is the exact inverse of `ci.yml`'s
   `paths-ignore:`, and the gate line in `AGENTS.md` and `docs/RUNBOOK.md` lists exactly
   those scripts.
5. The script modules pass their own tests: `node --test ".agents/scripts/**/*.test.mjs"`.
6. Merge settings via `gh api repos/{owner}/{repo}`: squash on, merge and rebase off,
   delete-branch-on-merge on.
7. The ruleset is active: `gh api repos/{owner}/{repo}/rulesets` lists `protect-default`
   with enforcement `active` (SKIP if the human has not done SETUP §4 yet, and say so). The
   repository variable `REVIEWER_LOGINS` is set (`gh variable list`).
8. A test PR (throwaway, closed unmerged) shows the five checks `checks`, `pr-hygiene`,
   `security`, `test-integrity` and `review-verdict` (the last may read "no verdict").
   **Expect red on the first runs:** the gating workflows run on the default branch's copy
   of the workflow files and of `.agents/scripts/`, so until the adoption PR has merged,
   `pr-hygiene`, `test-integrity` and `review-verdict` fail with "module not found" on
   the adoption PR itself and on any throwaway PR opened before it merges. The same holds
   when a playbook update changes a script's command line. Merge the adoption PR first (you
   are on the ruleset's bypass list), then open the throwaway PR.

## Summarize and offer the first commit

Print: what was written versus what existed and how each conflict was resolved; the detected
values (default branch, test command, database yes/no); the clean-environment build result
as something you RAN; what was declined (recorded as accepted); what was left aspirational;
the verification lines. Then offer to commit, conventional title, no attribution trailers:

    chore(agents): adopt claude-playbook

Do not push. The adoption touches protected paths and the human pushes it from their own
shell, through a PR.
