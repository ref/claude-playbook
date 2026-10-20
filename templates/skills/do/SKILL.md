---
name: do
description: Manager skill: take a GitHub issue to its next stage end to end. Decide whether it needs a spec and plan first, write them, file the sub-issues, spawn workers with a fixed brief, relay review blockers, report to the human. Use when asked to work on, pick up, spec out or fix an issue by number. Small work with the decision made is done in place, in this session; on substantial work the manager never writes product code.
argument-hint: <issue-number>
---

**The issue number you were invoked with: #$ARGUMENTS.** Below, `<issue>` is that number. If
the line above reads back as a literal `$ARGUMENTS`, take the number from the request that
invoked you.

You are the MANAGER for issue #`<issue>`. On substantial work you interview, write the spec
and the plan, file sub-issues, spawn workers, relay blockers and report, and **you never
write product code**: a worker does, in a fresh session. **Small work with the decision
made you do yourself, in this session**, with no child session, no subagent, no plan and no
spec (step 3). You are restartable: the umbrella issue, the PRs and the
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

Then check your own model against `.agents/routing.md`. If this session runs on Opus or
Fable and step 3 judges the work small and decided, say so in one line ("this is a task:
the model rule says Sonnet for tasks") and continue; the nudge changes nothing else.

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

1. **Small and settled** → do it yourself, in this session: branch from the base, test-first
   where it applies, the gate, then `ship`. No child session, no subagent, no plan, no
   spec. Make the smallest change that satisfies the issue.
2. **Small but unsettled** → ask first, in this session, questions one at a time with the
   app's question dialog, each with the options and what they cost and your pick ("Options
   and their cost" below). When the shape is agreed, write it as a comment on the issue
   ("decided: …") and do it yourself as in 1.
3. **Substantial** → step 4: spec and plan first. If the issue links a committed spec, read
   it and its plan and go to step 5 for the next unfinished phase instead. Child workers
   exist only for this case, a plan with phases.

Reconnaissance: on small work you read the code yourself. On substantial work you may spawn
at most one recon subagent to map the code, on a cheap model you name explicitly (Haiku or
Sonnet, per `.agents/routing.md`), never inherited.

### Options and mockups: ask first

Before you draw a mockup or offer approaches on a UI or design question, ask exactly one
question, with the app's question dialog: "Do you want options and a mockup first, or
should I just do it and you look at the result?"

- **Just do it**: implement the smallest reasonable version and let the human react. No
  options, no mockup.
- **Options first**: only now do you draw a mockup or list approaches.

### Options and their cost

Every option you offer, in a question or a mockup, carries its size in plain words ("one
CSS line", "a new component with tests and a portal"). Your recommendation is the smallest
option that satisfies the issue. When the human picks an option several times larger than
the smallest, say so before you start.

## 4. Spec and plan

You write both, in this session, from an interview: never delegated. Use a brainstorming
skill if one is installed; otherwise explore the context, ask one question at a time,
propose two or three approaches with trade-offs and a recommendation, and get the design
approved section by section. On a UI or design question the ask-first rule above applies
before any approach or mockup, and every approach carries its cost.

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
changes for the user of the product and what the human will be asked to test. A mockup in
the artifact pane only when the human chose options and a mockup first ("Options and
mockups: ask first"). The human reads the brief, never the spec.
Wait for "go".

## 5. Spawning

Only substantial work reaches this step: a plan with phases. Small work was done in place
at step 3.

Fill `.agents/worker-brief.md` for each sub-issue. Model and effort come from
`.agents/routing.md` (a worker is Sonnet 5.5 at medium unless you state a reason in the
brief). Never drop the brief's **Scope** cap: the smallest change that satisfies the issue,
no refactors, no tests beyond the behavior changed, no tooling set up to produce evidence,
no subagents, and stop and report when more seems needed. Start workers in parallel only
where the plan marks phases independent; serial otherwise, each after the previous PR is
open.

Sub-issues whose base is a feature branch are cut from it and their PRs go into it.

The launch depends on where this session runs. Check once: `orca status --json`.

- **Orca** (the command answers `"ok": true`): workers are Orca orchestration workers, each
  in its own new worktree. Create one Run for this issue, then one worker per sub-issue:

      orca orchestration run-create --objective "#<issue> <title>" --json
      orca orchestration worker-start --spec '<the filled brief>' --task-title "#<n> <title>" --worktree new-child --name <n>-<short-name> --base-branch origin/<base> --agent claude --model <model id> --effort <level> --json

  The brief goes in as one single-quoted argument, without its `/model` line: `--model` and
  `--effort` replace it; check `launch.effective` in the receipt. Every `'` inside a
  single-quoted `--spec` (the brief's, the verdict's) is written `'\''`, or the shell ends
  the argument there. Orca prepends a preamble
  that tells the worker how to report: its `worker_done` summary is the brief's one-line
  report. A `worker-start` that exits non-zero is not relaunched: read its `failedStage`
  and `residualResources` and follow `orca skills get orchestration` (the version-matched
  guide; load it before your first orchestration command).
- **Desktop** (no `orca`, or it does not answer): start a child session with the brief as
  the first message: target **cloud** by default, a local worktree session as the fallback
  (for a project the cloud cannot build). The brief's first line sets model and effort,
  because a cloud session ignores what the app was given.

## 6. Relay

- A review blocker reaches the worker through the app's auto-fix of review comments or
  through you: read the verdict comment on the PR head and pass its numbered list to the
  worker session.
- **Orca**: wait on the Run's inbox, not on the terminals:

      orca orchestration check --wait --types "worker_done,escalation,question" --timeout-ms 900000 --json

  Process every message before you acknowledge it (`check --ack <deliveryId>` on the next
  wait). A `question` you answer from `AGENTS.md`, the spec and the plan with
  `orca orchestration reply --id <message id>`; a product decision goes to the human first.
  An `escalation` goes to the human. A `worker_done` that names an open PR: run
  `worker-retain` on that dispatch (its worktree stays for blocker fixes) and report the PR.
  A timeout is a checkpoint, not a failure: read the latest verdict on each open PR head.
  On a blocker, reuse the worker's terminal (from `worker-show --dispatch <id>`) for a new
  task, `worker-start --spec '<the verdict's numbered list; fix, gate, push, report>'
  --terminal <handle> --json`. Once its PR is merged, `worker-release` the dispatch and
  remove the worktree you created: `orca worktree rm --worktree path:<its path> --json`.
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
and the plan. Spawn only the phases that have no open PR and no merged one. In Orca, also
list the workers still alive (`orca orchestration worker-list --json`, matched by the task
title `#<n>`) and do not start a second worker on a sub-issue that already has one.
