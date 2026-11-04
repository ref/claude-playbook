import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { check, isProtectedPath, loadConfig } from './gates.mjs';

const body = (text) => `## What changed\n\nx\n\n## Gates changed\n\n${text}\n\n## Docs\n\nDocs: none — x\n`;

test('the shipped protected.json carries the gates every adopter has', () => {
  const config = loadConfig();
  assert.deepEqual(config.prefixes, ['.github/workflows/', '.githooks/', '.agents/']);
  assert.deepEqual([...config.files], ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json']);
});

test('protected paths', () => {
  for (const p of [
    '.github/workflows/ci.yml',
    '.githooks/pre-push',
    '.agents/scripts/pr-wait/wait.mjs',
    '.agents/scripts/gates-changed/protected.json',
    'AGENTS.md',
    'CLAUDE.md',
    '.claude/settings.json',
  ]) {
    assert.equal(isProtectedPath(p), true, p);
  }
});

test('ordinary paths are not protected', () => {
  for (const p of ['src/a.ts', 'docs/RUNBOOK.md', 'README.md', '.github/pull_request_template.md', 'vitest.config.ts', 'docs/AGENTS.md']) {
    assert.equal(isProtectedPath(p), false, p);
  }
});

test('a project adds its own gate files through the config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gates-'));
  const file = join(dir, 'protected.json');
  writeFileSync(file, JSON.stringify({ prefixes: ['.agents/'], files: ['AGENTS.md', 'vitest.config.ts'] }));
  const config = loadConfig(pathToFileURL(file));
  assert.equal(isProtectedPath('vitest.config.ts', config), true);
  assert.equal(isProtectedPath('src/vitest.config.ts', config), false);
  assert.equal(isProtectedPath('.githooks/pre-push', config), false, 'only what the config lists');
  const r = check({ files: ['vitest.config.ts'], body: '## What changed\n\nx\n', author: 'ref', config });
  assert.equal(r.ok, false);
  assert.deepEqual(r.touched, ['vitest.config.ts']);
});

test('a config missing a key means no entries of that kind', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gates-'));
  const file = join(dir, 'protected.json');
  writeFileSync(file, JSON.stringify({ files: ['AGENTS.md'] }));
  const config = loadConfig(pathToFileURL(file));
  assert.equal(isProtectedPath('AGENTS.md', config), true);
  assert.equal(isProtectedPath('.agents/x.mjs', config), false);
});

test('no protected path touched: passes without the section', () => {
  const r = check({ files: ['src/a.ts'], body: '## What changed\n\nx\n', author: 'ref' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.touched, []);
});

test('protected path without the section fails and names the path and the section', () => {
  const r = check({ files: ['src/a.ts', '.github/workflows/ci.yml'], body: '## What changed\n\nx\n', author: 'ref' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.touched, ['.github/workflows/ci.yml']);
  assert.match(r.message, /\.github\/workflows\/ci\.yml/);
  assert.match(r.message, /## Gates changed/);
});

test('an empty or placeholder section fails', () => {
  for (const text of ['', '   ', '<!-- why -->', 'none', 'None.', 'N/A', '-']) {
    const r = check({ files: ['AGENTS.md'], body: body(text), author: 'ref' });
    assert.equal(r.ok, false, JSON.stringify(text));
  }
});

test('a filled section passes', () => {
  const r = check({ files: ['AGENTS.md'], body: body('Adds the protected-path rule.'), author: 'ref' });
  assert.equal(r.ok, true);
});

test('the section is found by heading, not by substring', () => {
  const r = check({ files: ['AGENTS.md'], body: 'See Gates changed above.\n### Gates changed\n\ntext\n', author: 'ref' });
  assert.equal(r.ok, false);
});

test('dependabot is exempt for workflow pins only', () => {
  const pins = check({ files: ['.github/workflows/ci.yml', '.github/workflows/release.yml'], body: '', author: 'dependabot[bot]' });
  assert.equal(pins.ok, true);
  const other = check({ files: ['.github/workflows/ci.yml', '.agents/scripts/x.mjs'], body: '', author: 'dependabot[bot]' });
  assert.equal(other.ok, false);
  assert.deepEqual(other.touched, ['.agents/scripts/x.mjs']);
});

test('a human author gets no workflow exemption', () => {
  assert.equal(check({ files: ['.github/workflows/ci.yml'], body: '', author: 'ref' }).ok, false);
});

// The CLI diffs base...head in a scratch repository, the way pr-gates.yml calls it.
const cli = fileURLToPath(new URL('./gates.mjs', import.meta.url));

function git(cwd, ...args) {
  const res = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@example.com',
    },
  });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout;
}

function repoWithGateChange() {
  const dir = mkdtempSync(join(tmpdir(), 'gates-repo-'));
  git(dir, 'init', '-q', '-b', 'main');
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'name: CI\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'switch', '-q', '-c', 'task');
  writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'name: CI\non: push\n');
  git(dir, 'commit', '-q', '-am', 'change the gate');
  return dir;
}

function runCli(dir, bodyText, author = 'ref') {
  const bodyFile = join(dir, 'body.md');
  writeFileSync(bodyFile, bodyText);
  return spawnSync(process.execPath, [cli, '--base', 'main', '--head', 'task', '--body-file', bodyFile, '--author', author], {
    cwd: dir,
    encoding: 'utf8',
  });
}

test('CLI exits 1 when a gate changed and the body has no section, 0 when it explains', () => {
  const dir = repoWithGateChange();
  const red = runCli(dir, '## What changed\n\nx\n');
  assert.equal(red.status, 1);
  assert.match(red.stderr, /\.github\/workflows\/ci\.yml/);
  const green = runCli(dir, body('The push trigger was missing.'));
  assert.equal(green.status, 0, green.stderr);
});

test('CLI exits 1 on missing arguments', () => {
  const res = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /usage/);
});
