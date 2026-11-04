# claude-playbook

A personal Claude Code workflow: a manager session, cloud workers, an executing reviewer and GitHub gates.

The manager runs in the Claude desktop app or in [Orca](https://www.onorca.dev/), whose orchestration workers `/do` uses when it finds Orca; the gates and the reviewer routine are the same with either (`docs/SETUP.md` §3).

Three required checks gate every PR: `checks` (one short run: secrets, lint, knip, format, types, tests; it also runs on every code push to the trunk and opens a `master-red` issue when that goes red), `pr-gates` (title, body, test integrity and a `## Gates changed` section for a PR that touches the gates) and `review-verdict` (the executing reviewer's approve, by comment). A project with a `Dockerfile` can add the optional `release.yml`: a manual verify → publish → deploy run, versioned by commit count, with a one-click rollback.

Design: [docs/superpowers/specs/2026-10-16-claude-playbook-v2-design.md](docs/superpowers/specs/2026-10-16-claude-playbook-v2-design.md)

To adopt it, open a session in your repository and say: `read docs/ADOPT.md from github.com/ref/claude-playbook and install it`

To sync an adopted repository with this playbook later, run `/playbook-update`.

MIT licensed, see [LICENSE](LICENSE).
