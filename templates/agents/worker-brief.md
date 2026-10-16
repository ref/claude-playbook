# Worker brief

The manager fills this template and starts the worker session with it as the first message.
It is identical for a cloud session and a local worktree session; only the launch differs.
The first line is a command pair, taken from `.agents/routing.md`.

```
/model <model id> /effort <level>

**Repository:** <owner>/<repo>
**Base branch:** <trunk, or feature/<topic>>
**Issue:** #<n>
**Spec:** <path under docs/specs/, or "none">
**Plan:** <path under docs/plans/, or "none">
**Phase:** <the plan's phase for this issue, or "whole issue">
**Definition of done:** the PR is open against the base branch; the full gate is green; the
pre-review (`/code-review` on your own diff) is done and its findings fixed; the PR body
sections are filled with real evidence; you have reported.
**Rules:** read `AGENTS.md` first, then the spec, the plan and the issue (body and
comments). Follow `.agents/skills/ship/SKILL.md` to open the PR. In a cloud session every
GitHub call is `gh api` (REST).
**Out of scope:** <the nearest thing someone might assume is included>
**Report:** one line to the manager: PR number, state, blocking item
```
