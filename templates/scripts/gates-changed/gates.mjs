// A PR that changes a protected path (a gate, or the rules that define the gates) must explain
// the change in a non-empty `## Gates changed` section of its body. `checks` runs the PR's own
// ci.yml, so a PR can drop a step and stay green; this rule runs from the default branch, where
// the PR cannot edit it.
//
// The protected paths live in protected.json next to this file: `prefixes` (the start of a
// path) and `files` (whole paths). The playbook ships the gates every adopter has; a project
// adds its own (its test runner's config, say) to that file, which is itself protected.
//
// Dependabot is exempt for `.github/workflows/**` only: it bumps action pins there and cannot
// write a body section. Any other protected path it touches still needs the section.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CONFIG_URL = new URL('./protected.json', import.meta.url);
const DEPENDABOT = 'dependabot[bot]';

export function loadConfig(url = CONFIG_URL) {
  const { prefixes = [], files = [] } = JSON.parse(readFileSync(url, 'utf8'));
  return { prefixes, files: new Set(files) };
}

let shipped;
const shippedConfig = () => (shipped ??= loadConfig());

export function isProtectedPath(path, config = shippedConfig()) {
  return config.files.has(path) || config.prefixes.some((prefix) => path.startsWith(prefix));
}

function isExplained(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+gates changed\s*$/i.test(line));
  if (start === -1) return false;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  const text = (end === -1 ? rest : rest.slice(0, end))
    .join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  const bare = text.replace(/^[\s\-*`_]+|[\s.`_]+$/g, '').toLowerCase();
  return bare !== '' && bare !== 'none' && bare !== 'n/a';
}

export function check({ files, body, author, config = shippedConfig() }) {
  const dependabot = author === DEPENDABOT;
  const touched = files.filter(
    (file) => isProtectedPath(file, config) && !(dependabot && file.startsWith('.github/workflows/')),
  );
  const ok = touched.length === 0 || isExplained(body);
  const message = ok
    ? ''
    : `This PR changes protected paths:\n${touched.map((p) => `  ${p}`).join('\n')}\n` +
      'Add a non-empty "## Gates changed" section to the PR body that explains the change.';
  return { ok, touched, message };
}

function git(args) {
  const res = spawnSync('git', ['-c', 'core.quotepath=off', ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout;
}

function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) break;
    args[argv[i].slice(2)] = argv[i + 1];
  }
  if (!args.base || !args.head || !args['body-file']) {
    console.error('usage: gates.mjs --base <ref> --head <ref> --body-file <file> [--author <login>]');
    return 1;
  }
  // The repository under analysis is data: no external diff drivers or textconv filters.
  // --no-renames: a move out of a protected path must list the path it left.
  const files = git([
    'diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', `${args.base}...${args.head}`,
  ])
    .split(/\r?\n/)
    .filter(Boolean);
  const result = check({ files, body: readFileSync(args['body-file'], 'utf8'), author: args.author });
  if (!result.ok) console.error(result.message);
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
