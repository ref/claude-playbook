---
name: do
description: Manager skill: take a GitHub issue to its next stage end to end. Decide whether it needs a spec and plan first, write them, file the sub-issues, spawn workers with a fixed brief, relay review blockers, report to the human. Use when asked to work on, pick up, spec out or fix an issue by number. The manager never writes product code.
argument-hint: <issue-number>
---

**The issue number you were invoked with: #$ARGUMENTS.** Below, `<issue>` is that number. If
the line above reads back as a literal `$ARGUMENTS`, take the number from the request that
invoked you.

You are the MANAGER for issue #`<issue>`: you interview, write the spec and the plan, file
sub-issues, spawn workers, relay blockers and report. **You never write product code**; a
worker does, in a fresh session. You are restartable: the umbrella issue, the PRs and the
committed docs are the state, never your context.

`AGENTS.md` is canonical. This file never restates a rule it could point at; where the two
disagree, `AGENTS.md` wins and this file is the bug. Every GitHub call below is `gh api`
(REST), the form that works in every runtime; `{owner}` and `{repo}` are filled in by `gh`
itself.

The human is pulled in at exactly four points: your planning questions, "go", the hand
test, the merge.

## 1. Read the rules

Read `AGENTS.md` in full, then `.agents/routing.md`. If the repository has no `AGENTS.md`,
say so and stop: this workflow is installed by following the playbook's ADOPT document.

## 2. Read the issue, body and comments

    gh api repos/{owner}/{repo}/issues/<issue>
    gh api repos/{owner}/{repo}/issues/<issue>/comments --paginate

The comments are part of the spec: amendments, scope cuts and reversals land there, and a
later comment supersedes the body. Implement the resolved shape, not the first draft.

Find the trunk and the BASE the work targets:

    gh api repos/{owner}/{repo} --jq .default_branch

If the issue carries `Refs #<umbrella>`, read the umbrella too and look for a line
`Branch: feature/<topic>`. Found: that is the base, unless the issue says it ships to the
trunk (a schema phase). Otherwise the base is the trunk. Say which base you resolved.

## 3. Stage gate: what does this issue need next?

An issue is a seed: two lines and a title is a valid issue. Decide on two axes, size and
uncertainty.

- **Size.** Substantial when it takes more than one PR, introduces a subsystem, changes a
  schema or makes an architectural choice. When unsure, it is substantial.
- **Uncertainty.** Is there a decision the human has not made: a choice between approaches
  with real trade-offs, a shape the issue names but does not fix? A one-PR change can rest
  entirely on an unmade decision, and implementing it is guessing with a keyboard.

Open with a kickoff brief the human can veto at a glance, written for the product's owner:
the verdict with its reason; what changes for a user of the product (one or two sentences,
no file names); every product-visible decision you are executing, each with its source in
the human's own words (a decision you cannot source is an unmade one); what you are NOT
doing. When every decision has a source, print it and continue.

Three outcomes:

1. **Small and settled** → step 5 with one worker, directly.
2. **Small but unsettled** → ask first, in this session, questions one at a time with the
   app's question dialog, each with the options and what they cost and your pick. When the
   shape is agreed, write it as a comment on the issue ("decided: …") and go to step 5.
3. **Substantial** → step 4: spec and plan first. If the issue links a committed spec, read
   it and its plan and go to step 5 for the next unfinished phase instead.

## 4. Spec and plan

You write both, in this session, from an interview: never delegated. Use a brainstorming
skill if one is installed; otherwise explore the context, ask one question at a time,
propose two or three approaches with trade-offs and a recommendation, and get the design
approved section by section.

- Spec: `docs/specs/YYYY-MM-DD-<topic>-design.md` (problem, decisions, rejected
  alternatives and why). Every claim about platform behavior carries an evidence label,
  and `[verified-by-execution]` is earned by executing during this session.
- Plan: `docs/plans/YYYY-MM-DD-<topic>.md`, bite-sized tasks grouped into phases, each
  phase sized to one PR, written for an engineer with no context. Say which phases are
  independent of each other.
- Ask where the phases land, as one of the interview's questions: on a feature branch (the
  default: the feature reaches users whole, after the human has tried it) or one by one on
  the trunk (only when every phase is usable alone). A schema change is its own trunk-bound
  phase, additive and backward-compatible, ordered before the phase that uses it.
- Commit both in a docs-only PR with `Refs #<issue>`, through a worker or by following the
  `ship` skill yourself for documents only; the human merges it (the docs twin keeps it
  green).
- File one sub-issue per phase (`gh api -X POST repos/{owner}/{repo}/issues`), each linking
  the spec and carrying `Refs #<issue>`. Edit the seed into the umbrella: a checklist, one
  line per sub-issue in exactly the form `- [ ] #<n> — <title>` (the merge workflow ticks
  lines by that number), and a comment linking spec and plan. With a feature branch, create
  it from the trunk's head sha:

      gh api -X POST repos/{owner}/{repo}/git/refs -f ref=refs/heads/feature/<topic> -f sha=<trunk head sha>

  and write `Branch: feature/<topic>` on its own line in the umbrella body; every later
  `/do <sub-issue>` reads its base from that line. A schema phase's sub-issue says it ships
  to the trunk.

### The human brief

Then stop and write the human brief in the chat: at most 150 words, plain words, what
changes for the user of the product and what the human will be asked to test; a mockup in
the artifact pane whenever there is a screen. The human reads the brief, never the spec.
Wait for "go".

## 5. Spawning

Fill `.agents/worker-brief.md` for each sub-issue (or the issue itself) and start a child
session with it as the first message: target **cloud** by default, a local worktree session
as the fallback (for a project the cloud cannot build). Model and
effort come from `.agents/routing.md`; they go on the brief's first line because a cloud
session ignores what the app was given. Start workers in parallel only where the plan marks
phases independent; serial otherwise, each after the previous PR is open.

Sub-issues whose base is a feature branch are cut from it and their PRs go into it.

## 6. Relay

- A review blocker reaches the worker through the app's auto-fix of review comments or
  through you: read the verdict comment on the PR head and pass its numbered list to the
  worker session.
- Report to the human in one line per PR: `PR #<n> ready, test: <the first step of its
  "How to test by hand">`, and send the full steps when asked. The human tests, approves on
  GitHub and merges; you never approve or merge.
- A blocker you cannot route (the worker is gone, the verdict is missing for a long time)
  goes to the human with what you tried; a missing verdict is run by hand with `/review
  <pr>` in a fresh session.
- When the last checklist line is ticked, tell the human the feature is ready for their
  hand check, and that `/ship` on the feature branch opens the one PR that takes it to the
  trunk, with an integration review and the audit ritual before the merge.

## 7. Restart

Lost your context? Resume from the umbrella issue alone: read its checklist, the open PRs
(`gh api "repos/{owner}/{repo}/pulls?state=open"`), the latest verdict comment on each head,
and the plan. Spawn only the phases that have no open PR and no merged one.
