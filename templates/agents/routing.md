# Model routing

`AGENTS.md` carries the principles (the strongest tier plans, a mid tier executes, the
reviewer is never the author's session); this file carries the current model names and is
the only place to edit when models change. The manager may raise a tier with a reason; it
does not lower one.

| Role | Tier | Model | Effort |
|---|---|---|---|
| Manager, spec and plan | strongest | Fable 5.1 (`claude-fable-5-1`) | high |
| Worker | mid | Opus 5.5 (`claude-opus-5-5`) | medium; high for a phase the plan marks cross-cutting |
| Pre-review in the worker | the worker's own session | — | — |
| Reviewer routine | mid | Opus 5.5 (`claude-opus-5-5`) | medium |
| Audit | strongest | Fable 5.1 (`claude-fable-5-1`) | maximum |

Sonnet 5.5 (`claude-sonnet-5-5`) is the cheap tier. A worker uses it only for a phase the
plan marks mechanical (renames, config, docs) and the manager says so in the brief.

A cloud session started from the desktop app ignores the model and effort the app was
given, so the worker brief sets both itself on its first line (`/model`, `/effort`).
