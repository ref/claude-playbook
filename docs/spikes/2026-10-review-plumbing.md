# Spike: review plumbing (2026-10)

Throwaway. The findings are the deliverable; the procedure is below, the results table is
empty until it has been run. It runs in the **first adopter's** checkout, not in this
repository, after the two machine accounts, their tokens and the two cloud environments of
`docs/SETUP.md` §1–§3 exist.

## Procedure

1. In the adopter, create a throwaway branch with one trivial commit and open a PR
   (`gh api -X POST repos/<owner>/<repo>/pulls -f title=... -f head=... -f base=...`),
   authored by the agent identity (the `agent` preset or the worker environment). Note the
   PR number `<n>` and the head sha `<sha>`.
2. Create a routine in the Claude app on the adopter repository, environment
   `<repo>-reviewer`, with a PR trigger, and this literal prompt:

   > Post a comment on PR #<n> through `gh api` with the body
   > `Reviewed-by: claude/spike, head <sha>` and `VERDICT: approve`, then set a commit
   > status `spike` = success on that sha through `gh api`.

   The two calls the session is expected to make:

   ```
   gh api -X POST repos/{owner}/{repo}/issues/{n}/comments -f body=...
   gh api -X POST repos/{owner}/{repo}/statuses/{sha} -f state=success -f context=spike
   ```

   (The comment body is two lines: the `Reviewed-by` line, then the `VERDICT` line.)
3. Open the PR (or mark it ready), then push a second commit to the same branch. Observe
   what the routine does each time. Open a cloud session on `<repo>-worker` once, push a
   commit from it, and look at the login GitHub shows for that commit.
4. Fill in the table below, one line per row, with the observed value. Leave nothing
   implied: write `no` or `none` when that is the answer.
5. Decide the launch mode with the rule under the table and replace the last line of this
   file.

## Results

| # | Question | Observed |
|---|---|---|
| 1 | The login a cloud push appears under | |
| 2 | Whether `gh api` in the cloud authenticates as `GH_TOKEN` | |
| 3 | Which PR events a routine can be triggered on | |
| 4 | Whether `synchronize` (a push to an open PR) is among them | |
| 5 | The login of the posted comment | |
| 6 | Whether the status API call succeeded | |
| 7 | Time from PR open to comment, and limits consumed (from the session's usage view) | |

## Decision rule

`routine` if a routine fires on PR open and on push (rows 3 and 4 both yes, and rows 2, 5
and 6 show that the posted comment carries the reviewer login and the status call
succeeded); otherwise `manager-spawned` (spec 6.1 fallback: the manager starts the reviewer
as a child session per PR). Task 10's SETUP §5 reads the line below.

Launch mode: pending (routine | manager-spawned)
