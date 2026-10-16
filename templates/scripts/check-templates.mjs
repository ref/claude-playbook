// Checks the template tree: the only placeholder is {{DEFAULT_BRANCH}}, and every
// `.agents/…`, `.github/…`, `.githooks/…` or `docs/…` path a template mentions will exist
// in an adopted project. Stays in this repository; it is not installed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ALLOWED_PLACEHOLDERS = new Set(['{{DEFAULT_BRANCH}}']);

// Written at install time or by the owner, not shipped as templates.
const INSTALL_TIME_PATHS = [
  '.agents/playbook.lock',
  '.github/CODEOWNERS',
  'docs/specs',
  'docs/plans',
  '.claude/skills',
  '.agents/audit-external-prompt.md',
];

const INSTALL_TIME_DIRS = ['docs/specs', 'docs/plans', '.claude/skills'];

const SINGLE_FILE_MAP = {
  'RUNBOOK.md': 'docs/RUNBOOK.md',
  'pull_request_template.md': '.github/pull_request_template.md',
  'dependabot.yml': '.github/dependabot.yml',
  'settings.json': '.claude/settings.json',
  worktreeinclude: '.worktreeinclude',
  'AGENTS.md': 'AGENTS.md',
  'CLAUDE.md': 'CLAUDE.md',
};

export function placeholders(text) {
  return new Set(text.match(/\{\{[A-Z][A-Z0-9_]*\}\}/g) ?? []);
}

// Template path (relative to templates/, '/'-separated) -> installed path, or null for
// files that stay in this repository.
export function installedPath(templatePath) {
  const parts = templatePath.split('/');
  if (templatePath in SINGLE_FILE_MAP) return SINGLE_FILE_MAP[templatePath];
  if (parts[0] === 'skills' && parts.length >= 3) return `.agents/${templatePath}`;
  if (parts[0] === 'scripts' && parts.length >= 3) return `.agents/${templatePath}`;
  if (parts[0] === 'agents' && parts.length === 2) return `.agents/${parts[1]}`;
  if (parts[0] === 'workflows' && parts.length === 2) return `.github/${templatePath}`;
  if (parts[0] === 'githooks' && parts.length === 2) return `.${templatePath}`;
  return null;
}

const REF_RE = /(?:^|[\s`'"(\[,])((?:\.agents|\.github|\.githooks|docs)\/[A-Za-z0-9._/-]*[A-Za-z0-9_])(?![A-Za-z0-9_])/gm;

export function brokenRefs(text, existingPaths) {
  const broken = new Set();
  for (const match of text.matchAll(REF_RE)) {
    const path = match[1];
    const rest = text.slice(match.index + match[0].length);
    // A glob, a placeholder or a variable continues the path; it is not a file name.
    if (/^\/?[*<{$]/.test(rest)) continue;
    // Anything under a directory the project fills in itself (specs, plans) is fine.
    if (INSTALL_TIME_DIRS.some((dir) => path.startsWith(`${dir}/`))) continue;
    if (!existingPaths.has(path)) broken.add(path);
  }
  return [...broken];
}

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function existingInstalledPaths(root, files) {
  const existing = new Set(INSTALL_TIME_PATHS);
  const add = (path) => {
    let p = path;
    while (p && p !== '.') {
      existing.add(p);
      p = dirname(p);
    }
  };
  for (const path of INSTALL_TIME_PATHS) add(path);
  for (const file of files) {
    const installed = installedPath(relative(root, file).split(sep).join('/'));
    if (installed) add(installed);
  }
  return existing;
}

// Files that legitimately mention paths or tokens as strings, not as references.
function isScanned(templatePath) {
  return !/(^|\/)check-templates[^/]*$/.test(templatePath) && !templatePath.endsWith('.test.mjs');
}

// Every skill: frontmatter with a `name:` equal to its directory and a `description:`.
// Only `status` runs exclusively on the desktop and may call the GraphQL `gh` subcommands.
function skillProblems(templatePath, text) {
  const match = /^skills\/([^/]+)\/SKILL\.md$/.exec(templatePath);
  if (!match) return [];
  const problems = [];
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!front) {
    problems.push(`${templatePath}: missing frontmatter`);
  } else {
    const name = /^name: (.+)$/m.exec(front[1]);
    if (!name || name[1].trim() !== match[1]) {
      problems.push(`${templatePath}: frontmatter name must be "${match[1]}"`);
    }
    if (!/^description: .+/m.test(front[1])) {
      problems.push(`${templatePath}: frontmatter needs a description`);
    }
  }
  if (match[1] !== 'status' && /\bgh (pr|issue) /.test(text)) {
    problems.push(`${templatePath}: use gh api (REST); gh pr and gh issue are GraphQL`);
  }
  return problems;
}

export function scanTemplates(root) {
  const files = walk(root);
  const existing = existingInstalledPaths(root, files);
  const problems = [];
  for (const file of files) {
    const templatePath = relative(root, file).split(sep).join('/');
    if (!isScanned(templatePath)) continue;
    const text = readFileSync(file, 'utf8');
    problems.push(...skillProblems(templatePath, text));
    for (const token of placeholders(text)) {
      if (!ALLOWED_PLACEHOLDERS.has(token)) problems.push(`${templatePath}: unexpected placeholder ${token}`);
    }
    for (const ref of brokenRefs(text, existing)) {
      problems.push(`${templatePath}: references ${ref}, which no template installs`);
    }
  }
  return problems;
}

function main(argv) {
  const root = argv[0] ?? fileURLToPath(new URL('../', import.meta.url));
  const problems = scanTemplates(root);
  for (const problem of problems) console.error(problem);
  if (problems.length === 0) console.log('templates: no stray placeholders, no broken references');
  return problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
