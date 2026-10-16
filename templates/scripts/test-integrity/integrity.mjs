// Detects weakened tests in a pull request: deleted test files, added skip/only markers,
// fewer assertions. A finding is acceptable only when the PR body declares it under
// `## Tests changed`.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const TEST_DIRS = new Set(['tests', 'test', '__tests__']);
// `.skip`, `.only`, `.todo`, `.fails` (with `If` / `.each` variants), the x- and f- aliases
// at the start of a line, `{ skip: true }` options and Rust's #[ignore].
const SKIP_RE =
  /\.(?:skip|only|todo|fails)(?:If)?\b|\b(?:xit|xdescribe|xtest)\s*\(|^\s*(?:fit|fdescribe)\s*\(|\b(?:skip|only|todo)\s*:\s*true\b|#\[ignore\b/;
const ASSERT_RE = /\b(?:expect(?:\.soft|\.poll)?\s*\(|assert\w*\s*[.(]|assert\w*!\s*\()/;
const COMMENT_RE = /^\s*(?:\/\/|\/\*|\*)/;

export function isTestPath(path) {
  if (/\.mdx?$/.test(path)) return false;
  const parts = path.split('/');
  const name = parts.pop();
  return /\.(?:test|spec)\./.test(name) || parts.some((part) => TEST_DIRS.has(part));
}

function parseNameStatus(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split('\t');
      return { status, paths };
    });
}

// Per-file added and removed lines, from the headers `diff --git a/<x> b/<y>`.
function parseDiff(text) {
  const files = [];
  let current = null;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const header = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (header) {
      current = { path: header[2], added: [], removed: [] };
      files.push(current);
      continue;
    }
    if (!current || line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) current.added.push(line.slice(1));
    else if (line.startsWith('-')) current.removed.push(line.slice(1));
  }
  return files;
}

function isDeclared(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+tests changed\s*$/i.test(line));
  if (start === -1) return false;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  const text = (end === -1 ? rest : rest.slice(0, end))
    .join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  // "none", "None.", "`none`", "- none", "N/A": all say nothing changed.
  const bare = text.replace(/^[\s\-*`_]+|[\s.`_]+$/g, '').toLowerCase();
  return bare !== '' && bare !== 'none' && bare !== 'n/a';
}

export function findings({ nameStatus, diff, body }) {
  const items = [];
  const deleted = new Set();

  for (const { status, paths } of parseNameStatus(nameStatus)) {
    if (status.startsWith('D') && isTestPath(paths[0])) {
      deleted.add(paths[0]);
      items.push({ kind: 'deleted-test-file', path: paths[0], detail: 'deleted' });
    } else if (status.startsWith('R') && isTestPath(paths[0]) && !isTestPath(paths[1])) {
      deleted.add(paths[0]);
      items.push({
        kind: 'deleted-test-file',
        path: paths[0],
        detail: `renamed out of the test paths to ${paths[1]}`,
      });
    }
  }

  for (const file of parseDiff(diff)) {
    if (!isTestPath(file.path) || deleted.has(file.path)) continue;
    const marker = file.added.find((line) => SKIP_RE.test(line));
    if (marker !== undefined) {
      items.push({ kind: 'skip-marker-added', path: file.path, detail: marker.trim() });
    }
    const asserts = (lines) =>
      lines.filter((line) => !COMMENT_RE.test(line) && ASSERT_RE.test(line)).length;
    const net = asserts(file.removed) - asserts(file.added);
    if (net > 0) {
      items.push({ kind: 'assertions-removed', path: file.path, detail: String(net) });
    }
  }

  const declared = isDeclared(body);
  return { items, declared, ok: items.length === 0 || declared };
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
    console.error('usage: integrity.mjs --base <ref> --head <ref> --body-file <file>');
    return 1;
  }
  const range = `${args.base}...${args.head}`;
  // The repository under analysis is data: no external diff drivers or textconv filters.
  const nameStatus = git(['diff', '--no-ext-diff', '--no-textconv', '--name-status', '-M', range]);
  const testPaths = parseNameStatus(nameStatus)
    .flatMap(({ paths }) => paths)
    .filter(isTestPath);
  const diff = testPaths.length
    ? git(['diff', '--no-ext-diff', '--no-textconv', '-M', range, '--',...[...new Set(testPaths)].map((p) => `:(literal)${p}`)])
    : '';
  const result = findings({ nameStatus, diff, body: readFileSync(args['body-file'], 'utf8') });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    for (const item of result.items) {
      console.error(`${item.kind}: ${item.path} (${item.detail})`);
    }
    console.error('Declare each under "## Tests changed" in the PR body, with the reason.');
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
