# Worker brief

The manager fills this template and starts the worker session with it as the first message.
It is identical for a cloud session, a local worktree session and an Orca worker; only the
launch differs. The first line is a command pair, taken from `.agents/routing.md`: the worker
row, Sonnet 5.5 at medium, unless the manager states a reason for more on the line below it.
An Orca worker gets model and effort as launch flags instead, so its brief drops that line.

```
/model <model id> /effort <level>
<only when raising the worker row: "Raised because: <reason>">

**Repository:** <owner>/<repo>
**Base branch:** <trunk, or feature/<topic>>
**Issue:** #<n>
**Spec:** <path under docs/specs/, or "none">
**Plan:** <path under docs/plans/, or "none">
**Phase:** <the plan's phase for this issue, or "whole issue">
**Definition of done:** the PR is open against the base branch; the full gate is green; the
pre-review (`/code-review` on your own diff) is done and its findings fixed; the PR body
sections are filled with real evidence; the wait after the PR (`ship` step 6) ended green
or needs the human; you have reported.
**Rules:** read `AGENTS.md` first, then the spec, the plan and the issue (body and
comments). Follow `.agents/skills/ship/SKILL.md` to open the PR. In a cloud session every
GitHub call is `gh api` (REST).
**Scope:** the smallest change that satisfies the issue. No refactors. No tests beyond the
behavior you change. No tooling set up to produce evidence (no browser, no screenshot or
measurement pipeline). No subagents. If more seems needed, stop and report to the manager
instead of widening.
**Out of scope:** <the nearest thing someone might assume is included>
**Report:** one line to the manager: PR number, state, blocking item
```
