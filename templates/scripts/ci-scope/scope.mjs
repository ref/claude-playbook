// Decides whether a PR's changed files need the code checks in ci.yml. Reads the file list
// (one path per line) on stdin and prints `code=true` or `code=false`.
//
// Documentation is `docs/`, a `.md` file, or `.claude/`, EXCEPT what a gating test or a gate
// reads: everything under `.agents/` and `.github/`, the `.claude/skills/` symlinks and
// `.claude/settings.json`. `case`-style globs let `*.md` cross slashes, which is how
// `.agents/skills/review/SKILL.md` would otherwise count as docs. The push trigger's `paths`
// list in ci.yml encodes the same rule; scope.test.mjs pins the two together.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const NEVER_DOCS_PREFIXES = ['.agents/', '.github/', '.claude/skills/'];
export const NEVER_DOCS_FILES = ['.claude/settings.json'];
export const DOCS_PREFIXES = ['docs/', '.claude/'];

function isNeverDocs(path) {
  return NEVER_DOCS_FILES.includes(path) || NEVER_DOCS_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function isDocPath(path) {
  if (isNeverDocs(path)) return false;
  return path.endsWith('.md') || DOCS_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// An empty diff runs the checks: nothing proves the change is harmless.
export function needsCodeChecks(files) {
  return files.length === 0 || files.some((file) => !isDocPath(file));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = readFileSync(0, 'utf8').split(/\r?\n/).filter(Boolean);
  console.log(`code=${needsCodeChecks(files)}`);
}
