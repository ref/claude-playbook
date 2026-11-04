import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DOCS_PREFIXES, isDocPath, NEVER_DOCS_FILES, NEVER_DOCS_PREFIXES, needsCodeChecks } from './scope.mjs';

test('plain documentation is documentation', () => {
  for (const p of ['README.md', 'AGENTS.md', 'docs/RUNBOOK.md', 'docs/previews/a.html', 'src/x/NOTES.md', '.claude/notes.txt']) {
    assert.equal(isDocPath(p), true, p);
  }
});

test('files the gating tests read are not documentation', () => {
  for (const p of [
    '.agents/skills/review/SKILL.md',
    '.agents/scripts/pr-wait/wait.mjs',
    '.github/pull_request_template.md',
    '.github/workflows/ci.yml',
    '.claude/settings.json',
    '.claude/skills/review', // a symlink into .agents/skills/review
  ]) {
    assert.equal(isDocPath(p), false, p);
  }
});

test('code is not documentation', () => {
  assert.equal(isDocPath('src/app/page.tsx'), false);
  assert.equal(isDocPath('package.json'), false);
});

test('needsCodeChecks: docs only skips, any other file runs', () => {
  assert.equal(needsCodeChecks(['README.md', 'docs/a.md']), false);
  assert.equal(needsCodeChecks(['README.md', 'src/a.ts']), true);
  assert.equal(needsCodeChecks(['.agents/skills/review/SKILL.md']), true);
  assert.equal(needsCodeChecks(['.github/pull_request_template.md']), true);
  assert.equal(needsCodeChecks(['.claude/settings.json']), true);
});

test('needsCodeChecks: an empty diff runs the checks', () => {
  assert.equal(needsCodeChecks([]), true);
});

const cli = fileURLToPath(new URL('./scope.mjs', import.meta.url));

test('CLI reads one path per line on stdin and prints code=<bool>', () => {
  const docs = spawnSync(process.execPath, [cli], { encoding: 'utf8', input: 'README.md\ndocs/a.md\n' });
  assert.equal(docs.status, 0);
  assert.equal(docs.stdout.trim(), 'code=false');
  const code = spawnSync(process.execPath, [cli], { encoding: 'utf8', input: 'README.md\r\nsrc/a.ts\r\n' });
  assert.equal(code.stdout.trim(), 'code=true');
  const empty = spawnSync(process.execPath, [cli], { encoding: 'utf8', input: '' });
  assert.equal(empty.stdout.trim(), 'code=true');
});

// The push trigger in ci.yml cannot run this script: it is a `paths` filter, so it carries
// the same rule as a list of patterns. Pin the two together, so a path that moves from one
// class to the other moves in both files.
const workflowFile = [
  new URL('../../workflows/ci.yml', import.meta.url),
  new URL('../../../.github/workflows/ci.yml', import.meta.url),
].find((url) => existsSync(url));
const workflowText = workflowFile ? readFileSync(workflowFile, 'utf8') : '';

test("ci.yml's push paths filter encodes the same rule as this script", () => {
  assert.ok(workflowText, 'ci.yml not found next to the script module');
  const push = /\n  push:\n([\s\S]*?)\n\nconcurrency:/.exec(workflowText);
  assert.ok(push, 'ci.yml has a push trigger followed by the concurrency block');
  const patterns = [...push[1].matchAll(/^\s+- "([^"]+)"$/gm)].map((m) => m[1]);
  assert.equal(patterns[0], '**', 'the filter starts by including everything');
  for (const prefix of DOCS_PREFIXES) assert.ok(patterns.includes(`!${prefix}**`), `excludes ${prefix}**`);
  assert.ok(patterns.includes('!**.md'), 'excludes **.md');
  for (const prefix of NEVER_DOCS_PREFIXES) assert.ok(patterns.includes(`${prefix}**`), `re-includes ${prefix}**`);
  for (const file of NEVER_DOCS_FILES) assert.ok(patterns.includes(file), `re-includes ${file}`);
  // Order matters: the last matching pattern wins, so every re-include follows every exclusion.
  const lastExclude = Math.max(...patterns.map((p, i) => (p.startsWith('!') ? i : -1)));
  const firstInclude = patterns.findIndex((p, i) => i > 0 && !p.startsWith('!'));
  assert.ok(firstInclude > lastExclude, 're-includes come after the exclusions');
});
