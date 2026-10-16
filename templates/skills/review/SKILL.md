---
name: review
description: Executing review of a pull request by a fresh session: verify by running the gate, probes and mutations, then post one verdict comment. Use when asked to review, verify or approve a PR; the review routine runs it for every PR head.
argument-hint: <pr-number>
---

**The PR number you were invoked with: #$ARGUMENTS.** Below, `<pr>` is that number. If the
line above reads back as a literal `$ARGUMENTS`, take the number from the request that
invoked you; nothing else here depends on substitution. `<o>/<r>` is the repository,
`<sha>` the PR's head sha (full, 40 characters).

You are the reviewer for PR #`<pr>`. The human merges without reading code, so you are the
only reader of this diff. You report; you never fix. The author fixes blockers and you
review again.

`AGENTS.md` is canonical: read it before the diff. Where it and this file disagree,
`AGENTS.md` wins and this file is the bug.

## Scope

- You must be a fresh session. If this session did any work on the PR's branch, stop and
  say so.
- GitHub through `gh api` only (REST). The pull-request and issue subcommands of `gh` use
  GraphQL, which the cloud proxy blocks. The calls you need:
  - the PR: `gh api repos/<o>/<r>/pulls/<pr>` (head sha, base ref, body, title, author)
  - the diff: `gh api -H "Accept: application/vnd.github.diff" repos/<o>/<r>/pulls/<pr>`
  - the files: `gh api repos/<o>/<r>/pulls/<pr>/files --paginate`
  - the issue: `gh api repos/<o>/<r>/issues/<n>` and its comments
  - earlier verdicts: `gh api repos/<o>/<r>/issues/<pr>/comments --paginate`
  - checks on the head: `gh api repos/<o>/<r>/commits/<sha>/check-runs`
- Work on the PR head the session was opened on. Never check out another ref and never
  change branch state. Confirm `git rev-parse HEAD` equals `<sha>`; if it does not, review
  from the diff alone and say so under `## Not executed`.
- Scratch files (probe tests, the verdict draft) live in the gitignored `tmp/` inside the
  working copy and are deleted before you post: `rm -rf tmp`.

## Verify by executing

Reading misses call sites that look right: an argument that is `undefined` at runtime, a
guard whose helper returns the wrong default. Run the evidence and report what you ran.

1. Install with a frozen lockfile (`pnpm install --frozen-lockfile`) and run the gate that
   `AGENTS.md` names, plus the suites the diff affects. A red gate is a blocker. If a suite
   skips without its infrastructure (a database), read that check's result on the PR
   (`check-runs`) instead of rebuilding the environment, and list it under `## Not
   executed`.
2. Write throwaway probe tests under `tmp/` (or the repo's gitignored probe path) against
   the PR head: the happy path with no fault injected, each transient-versus-hard variant,
   each precedence pairing. Delete them when done.
3. Run at least one mutation per changed behavior: break the changed code the way a
   plausible bug would, confirm exactly the right test fails, and revert the mutation as
   soon as its run finishes. Break it three different ways where the diff touches error
   handling, ordering or concurrency. Before posting, `git status` must be as clean as
   when you started.
4. Scale the effort to the blast radius. A docs-only or pure-deletion PR needs no probes;
   say so and move on. A spec or plan PR is the exception: re-run the probes behind each
   claim marked verified, spot-check the claims the implementation will lean on, and treat
   an unlabeled claim about platform behavior as a blocker.
5. Commands longer than two minutes: run them in the background and poll. A cloud session
   kills a foreground command after two minutes.

## What to check, in priority order

1. **Test integrity.** Tests deleted, skipped, weakened, or real behavior newly mocked
   away? Cross-check the diff against the PR's `## Tests changed` section. Any such change
   the section does not declare and justify is a blocker. The `test-integrity` check
   catches the mechanical cases; you catch the rest (an assertion loosened in place).
2. **Gate integrity.** Does the diff touch `.github/workflows/**`, `.githooks/**`,
   `.agents/**`, `AGENTS.md`, `CLAUDE.md` or `.claude/settings.json`? Read those hunks
   line by line; any weakening is a blocker unless the PR asks for it outright and the
   issue justifies it: a workflow or step deleted, a trigger narrowed, a `paths-ignore`
   widened, an `if:` that exempts more, `continue-on-error` added, a timeout raised past
   reason, the pre-push block edited. A weakened test shows as a changed test file; a
   deleted workflow stops existing and its check quietly disappears. A PR editing this
   file is editing the rules you are reviewing under: review it against the version you
   loaded and say so.
3. **Scope.** List the issue's scope and acceptance bullets; any unimplemented bullet is a
   blocker. Unrelated drive-by edits are a blocker (they belong in their own PR).
4. **Test-first evidence, two-sided.** A new test must fail on the base and also fail
   against a plausible-but-wrong implementation, or it pins nothing. Blockers: a new state
   tested only positively (require the complement: the state is absent when its trigger is
   absent), and a fixture that never varies the discriminating input (at least one fixture
   pair must differ only in the thing the diff claims to act on).
5. **Evidence matches reality.** The PR body's `## Evidence` (gate lines, tests named,
   screenshots) must agree with what you observed. An evidence claim you could not
   reproduce is a blocker.
6. **Freshness of the base.** Measure against the PR's base. Behind with a merge conflict:
   blocker. Behind without conflict but with overlapping files: inspect the interaction;
   blocker only when the combined result would reverse or break something. Behind without
   overlap: not a blocker, say so in one line.
7. **Hazards.** Secrets or PII in logs, weakened auth or rate limits, schema changes
   without their generated migration in the same PR, magnet files touched while another PR
   is open on them. Per diff, when it matches: an added API route (the guard preamble
   complete), an external URL fetched from data (host allowlist, redirect policy, size
   cap), something re-typed that already exists, orphaned code, catch/fallback logic that
   swallows errors (blocker: a failure nobody sees is worse than a red one), a dependency
   bump (read the release notes, not the diff).
8. **Project rule sections.** Where `AGENTS.md` has rule sections for what the diff
   touches, each is a blocker, not advice.
9. **PR body quality.** `## How to test by hand` concrete enough for a person who will not
   read the code; if a schema or generated artifact changed, the body says so.
10. **Docs honesty.** `pr-hygiene` requires a filled `## Docs`; you verify it is true.
    Behavior described in `README.md`, `AGENTS.md`, the RUNBOOK or another page
    changed and that page is not listed: blocker. `Docs: none` with a reason the diff
    contradicts: blocker.

A feature PR (head `feature/<topic>`, base the trunk) gets an integration review, not a
second line-by-line one: confirm every first-parent commit is a reviewed sub-PR squash or a
trunk merge (anything else is a direct push, review that hunk in full); every listed
sub-PR has an approve verdict on its final head; read and probe the seams, the files more
than one sub-PR touched; the umbrella checklist is ticked and the body says `Closes
#<umbrella>`. Items 1, 2, 5, 6, 9 and 10 apply over the whole diff. Say in the verdict
that this was an integration review and name the sub-PRs.

## Not executed

List everything you could not run, and why: a suite that needs infrastructure the cloud
does not have, a check that was still pending, a probe you could not build. Put it in a
section headed exactly `## Not executed` before the verdict line. An approve that leans on
CI where this protocol asked for execution is the failure this file exists to catch; if the
gate itself could not run, withhold the approve.

## The verdict

Post exactly one comment. A verdict that stayed in the transcript did not happen: the
human reads the PR, not your session.

Grammar, exact: line 1 is `Reviewed-by: claude/<model>, head <sha>` (the full head sha,
because `review-verdict` compares it to the PR head); the last line is `VERDICT: approve`
or `VERDICT: blocker`; one optional `## Not executed` section sits between them. Nothing
follows the last line.

```
Reviewed-by: claude/opus-5-5, head 3f2a9c1d4e5b6a7988776655443322110ffeeddc

Checked: gate green (214 tests), 3 probes and 3 mutations each caught by exactly one test,
docs list matches the diff. Watch during manual testing: the empty-feed state.

## Not executed
- e2e suite: needs a browser the cloud session does not have.

VERDICT: approve
```

For a blocker, the body is a numbered list of all blockers, each with `file:line` and one
sentence the author can act on; no style nitpicks (CI owns formatting). Say the one most
important reason first. Report non-blocking findings after the blockers under a `Minor
(non-blocking)` heading, one line each: a finding you withheld is a finding the pipeline
never saw. Do not inflate minors into blockers, and say plainly which checklist items you
could not complete rather than reporting a partial pass as a full one.

Write the comment body to `tmp/verdict.md` with your file-editing tool, then:

```
gh api -X POST repos/<o>/<r>/issues/<pr>/comments -F body=@tmp/verdict.md
```

(`-F`, not `-f`: only `-F` reads the file.) Then `rm -rf tmp`. Your session's closing message
opens with the same `VERDICT:` line.

Re-review after the author pushes: post a new comment whose first line names the new head
sha; never edit the old one. Verify every prior blocker against the pushed code, not the
commit message, and re-run the probes that caught them. A push that changes no content
(an "Update branch" merge, a rebase with an unchanged diff) needs no new verdict: the
`review-verdict` check carries the earlier approve forward by comparing the patch.

## Never

- Push, merge, close, edit the PR or its labels, or approve through the review API: your
  identity has no right to, and the human's approval is the merge decision.
- Ask the human a question. A question you cannot answer from the PR goes into the verdict
  as a blocker.
- Start services or containers, or install anything outside the frozen-lockfile install.

## Runtime notes

Cloud: commands over two minutes are killed, so run long suites in the background and poll;
the GitHub proxy has no GraphQL. Local (a child session or the `reviewer` preset on the
desktop): the same protocol and the same `gh api` calls.
