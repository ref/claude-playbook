---
name: status
description: Where are we: feature branches against their umbrellas, open PRs by stage with their review verdicts and checks, open issues, answered in the chat in at most fifteen lines. Desktop only. Use when asked for status, progress or what is open.
---

Desktop sessions only. This is the one skill that may use `gh pr` and `gh issue` (GraphQL),
which the cloud proxy blocks; in a cloud session, say so and use `gh api` instead.

Read live, no page, no loop:

    gh issue list --state open --json number,title,body,labels
    gh pr list --state open --json number,title,body,headRefName,baseRefName,statusCheckRollup,author
    gh pr list --state merged --limit 10 --json number,title,baseRefName,mergedAt

Then:

- **Umbrellas.** An open issue whose body carries `Branch: feature/<topic>` is an umbrella:
  count its `- [x] #<n>` against `- [ ] #<n>` lines.
- **PRs by stage.** For each open PR, in this order: waiting for checks (any required check
  pending or red: name it); waiting for the verdict (`review-verdict` pending or failing:
  quote the status description, for example `no verdict for <sha>`); blocked (the latest
  verdict is a blocker); ready for you (all five checks green: `checks`, `pr-hygiene`,
  `security`, `test-integrity`, `review-verdict`), with the first line of its "How to test
  by hand".
- **Open issues.** The ones no umbrella or open PR covers.

Answer in the chat in at most fifteen lines: one line per umbrella (`feature/<topic>: 3 of
5 done`), one per PR (`#<n> <stage> — <what is next>`), then the uncovered issues as a
single line. Say what you could not read rather than guessing.
