# Model routing

`AGENTS.md` carries the principles (the strongest tier thinks, a cheap tier executes, the
reviewer is never the author's session); this file carries the current model names and is
the only place to edit when models change. The human picks the model of a session by the
kind of work, never by hand each time.

| Kind of work | Model | Effort |
|---|---|---|
| **Task**: `/do` on small settled work, `/review`, `/status`, `/playbook-update`, small fixes | Sonnet 5.5 (`claude-sonnet-5-5`) | medium |
| **Discussion**: designing a feature, spec and plan, a hard bug | Opus 5.5 (`claude-opus-5-5`) | high |
| **Serious thinking**: architecture, `/audit` of a whole feature, a second opinion | Fable 5.1 (`claude-fable-5-1`) | high; maximum only for an audit |
| Child worker | Sonnet 5.5 (`claude-sonnet-5-5`) | medium |
| Subagent inside any session | Haiku 5.5 (`claude-haiku-5-5`) or Sonnet 5.5, always named explicitly | — |
| Reviewer routine | Sonnet 5.5 (`claude-sonnet-5-5`) | medium |

Effort is how long the model thinks per step: medium is normal; high is slower and costs
roughly 1.5–2×.

A subagent never inherits its parent's model: the session that starts one names the model
in the call. A worker runs on the row above unless the manager states a reason in the brief
for raising it; the manager does not lower it.

A cloud session started from the desktop app ignores the model and effort the app was
given, so the worker brief sets both itself on its first line (`/model`, `/effort`).
