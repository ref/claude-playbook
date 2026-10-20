# claude-playbook

A personal Claude Code workflow: a manager session, cloud workers, an executing reviewer and GitHub gates.

The manager runs in the Claude desktop app or in [Orca](https://www.onorca.dev/), whose orchestration workers `/do` uses when it finds Orca; the gates and the reviewer routine are the same with either (`docs/SETUP.md` §3).

Design: [docs/superpowers/specs/2026-10-16-claude-playbook-v2-design.md](docs/superpowers/specs/2026-10-16-claude-playbook-v2-design.md)

To adopt it, open a session in your repository and say: `read docs/ADOPT.md from github.com/ref/claude-playbook and install it`

To sync an adopted repository with this playbook later, run `/playbook-update`.

MIT licensed, see [LICENSE](LICENSE).
