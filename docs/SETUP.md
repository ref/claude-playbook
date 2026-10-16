# SETUP — the human's one-time configuration

`docs/ADOPT.md` is the agent's page; this one is yours. Sections 1–3 are done once per
machine and account pair; sections 4–7 are done once per repository. `<owner>` and `<repo>`
below are your GitHub login and the repository name.

## 1. Identities

GitHub must be able to tell an agent from you, otherwise the approval rule in section 4 is
not a machine guarantee. There are three identities:

| Role | Who | Used in |
|---|---|---|
| owner | you | your own shell and the GitHub UI, nowhere else |
| agent | a second GitHub account (machine user) | worker cloud environments, the `agent` desktop preset |
| reviewer | a third GitHub account (machine user) | the reviewer cloud environment, the `reviewer` desktop preset |

Create the two machine accounts by hand (account creation is not something an agent does).
Then, for each one, create a fine-grained personal access token scoped to the repositories
that will adopt the playbook:

- **agent** token: Contents write, Pull requests write, Issues write, Metadata read.
- **reviewer** token: Contents read, Pull requests write, Commit statuses write, Issues
  read, Metadata read. It has no push right, so it cannot change the code it reviews.

Invite both accounts to each repository as collaborators with the **Write** role. The
reviewer is not a code owner, so its approving review never satisfies the ruleset.

Token expiry: one year. Put a calendar reminder a month before it.

Why machine users and not GitHub Apps: App tokens expire hourly, while presets and cloud
environments hold long-lived secrets.

## 2. Cloud environments

Per adopting repository, create two Claude cloud environments:

| Environment | Name | Network | Secret |
|---|---|---|---|
| worker | `<repo>-worker` | trusted | the agent token, as a network secret named `GH_TOKEN` |
| reviewer | `<repo>-reviewer` | trusted | the reviewer token, as a network secret named `GH_TOKEN` |

Both use the setup script `templates/cloud-setup.sh` from this repository, adapted per
project (section 6 explains it; the script itself is written in the playbook's Task 10 and
named here only so the environments can reference it).

Cloud sessions reach GitHub through a proxy that blocks GraphQL: `gh pr …` and `gh issue …`
fail there, `gh api` (REST) works. Every playbook skill that may run in the cloud uses
`gh api` only.

## 3. Desktop presets

In the Claude desktop app create two session presets:

| Preset | Carries |
|---|---|
| `agent` | `GH_TOKEN` = the agent token. Every manager and every local worker session uses it. |
| `reviewer` | `GH_TOKEN` = the reviewer token. Used when you run `/review <n>` by hand. |

Your own terminal keeps your own `gh auth` login. Never start a manager or worker session
without the `agent` preset: a PR authored by you could not be approved by you, and the
ruleset would be unsatisfiable.
