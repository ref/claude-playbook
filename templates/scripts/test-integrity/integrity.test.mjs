import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findings, isTestPath } from './integrity.mjs';

function fileDiff(path, lines) {
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,3 +1,3 @@\n${lines.join('\n')}\n`;
}

const NO_BODY = '## What changed\n\nx\n';
const declared = (text) => `## Tests changed\n\n${text}\n\n## Docs\n\n* a.md — b\n`;

test('isTestPath', () => {
  for (const p of ['src/a.test.ts', 'tests/b.ts', 'src/__tests__/c.tsx', 'tests/d.rs', 'e.spec.mjs']) {
    assert.equal(isTestPath(p), true, p);
  }
  for (const p of ['src/a.ts', 'docs/testing.md', 'src/latest.ts', 'docs/tests/notes.md']) {
    assert.equal(isTestPath(p), false, p);
  }
});

test('deleted test file is a finding', () => {
  const r = findings({ nameStatus: 'D\tsrc/a.test.ts\n', diff: '', body: NO_BODY });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].kind, 'deleted-test-file');
  assert.equal(r.items[0].path, 'src/a.test.ts');
  assert.equal(r.ok, false);
});

test('deleting a non-test file is not a finding', () => {
  const r = findings({ nameStatus: 'D\tsrc/a.ts\n', diff: '', body: NO_BODY });
  assert.deepEqual(r.items, []);
});

test('rename is not a deletion', () => {
  const r = findings({
    nameStatus: 'R100\tsrc/a.test.ts\tsrc/b.test.ts\n',
    diff: '',
    body: NO_BODY,
  });
  assert.deepEqual(r.items, []);
  assert.equal(r.ok, true);
});

test('renaming a test file out of the test paths is a finding', () => {
  const r = findings({
    nameStatus: 'R100\tsrc/a.test.ts\tsrc/helpers.ts\n',
    diff: '',
    body: NO_BODY,
  });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].kind, 'deleted-test-file');
});

test('skip marker added is a finding', () => {
  for (const marker of ['it.skip(', 'describe.only(', 'xit(', 'xdescribe(', '#[ignore]']) {
    const diff = fileDiff('src/a.test.ts', [`+  ${marker}'x', () => {});`]);
    const r = findings({ nameStatus: 'M\tsrc/a.test.ts\n', diff, body: NO_BODY });
    assert.equal(r.items.length, 1, marker);
    assert.equal(r.items[0].kind, 'skip-marker-added', marker);
    assert.equal(r.items[0].path, 'src/a.test.ts');
  }
});

test('a skip marker on a removed or context line is not a finding', () => {
  const diff = fileDiff('src/a.test.ts', ["-  it.skip('x', () => {});", "   it.skip('y', () => {});"]);
  const r = findings({ nameStatus: 'M\tsrc/a.test.ts\n', diff, body: NO_BODY });
  assert.deepEqual(r.items, []);
});

test('a skip marker in a non-test file is not a finding', () => {
  const diff = fileDiff('src/a.ts', ['+  x.skip(1);']);
  const r = findings({ nameStatus: 'M\tsrc/a.ts\n', diff, body: NO_BODY });
  assert.deepEqual(r.items, []);
});

test('removed assertions are a finding', () => {
  const diff = fileDiff('src/a.test.ts', [
    '-  expect(a).toBe(1);',
    '-  expect(b).toBe(2);',
    '-  expect(c).toBe(3);',
    '+  expect(a).toBe(1);',
  ]);
  const r = findings({ nameStatus: 'M\tsrc/a.test.ts\n', diff, body: NO_BODY });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].kind, 'assertions-removed');
  assert.equal(r.items[0].detail, '2');
});

test('rewritten assertions with the same count are not a finding', () => {
  const diff = fileDiff('src/a.test.ts', ['-  expect(a).toBe(1);', '+  expect(a).toBe(2);']);
  const r = findings({ nameStatus: 'M\tsrc/a.test.ts\n', diff, body: NO_BODY });
  assert.deepEqual(r.items, []);
});

test('assert-style and Rust assertions count', () => {
  const diff = fileDiff('tests/d.rs', ['-  assert_eq!(a, 1);', '-  assert!(b);']);
  const r = findings({ nameStatus: 'M\ttests/d.rs\n', diff, body: NO_BODY });
  assert.equal(r.items[0].kind, 'assertions-removed');
  assert.equal(r.items[0].detail, '2');
});

test('assertions are counted per file, not across files', () => {
  const diff =
    fileDiff('src/a.test.ts', ['-  expect(a).toBe(1);']) +
    fileDiff('src/b.test.ts', ['+  expect(a).toBe(1);', '+  expect(b).toBe(1);']);
  const r = findings({
    nameStatus: 'M\tsrc/a.test.ts\nM\tsrc/b.test.ts\n',
    diff,
    body: NO_BODY,
  });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].path, 'src/a.test.ts');
});

test('a deleted file is reported once, not also as removed assertions', () => {
  const diff = fileDiff('src/a.test.ts', ['-  expect(a).toBe(1);']);
  const r = findings({ nameStatus: 'D\tsrc/a.test.ts\n', diff, body: NO_BODY });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].kind, 'deleted-test-file');
});

test('declaration under "## Tests changed" makes it ok', () => {
  const r = findings({
    nameStatus: 'D\tsrc/a.test.ts\n',
    diff: '',
    body: declared('Removed `a.test.ts`: the feature it covered is gone.'),
  });
  assert.equal(r.declared, true);
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 1);
});

test('"none" under Tests changed does not declare a deletion', () => {
  for (const none of ['none', 'None', ' NONE ']) {
    const r = findings({ nameStatus: 'D\tsrc/a.test.ts\n', diff: '', body: declared(none) });
    assert.equal(r.declared, false, none);
    assert.equal(r.ok, false, none);
  }
});

test('an empty Tests changed section does not declare', () => {
  const r = findings({
    nameStatus: 'D\tsrc/a.test.ts\n',
    diff: '',
    body: '## Tests changed\n\n## Docs\n\n* a.md — b\n',
  });
  assert.equal(r.declared, false);
  assert.equal(r.ok, false);
});

test('a declaration in a different section does not count', () => {
  const r = findings({
    nameStatus: 'D\tsrc/a.test.ts\n',
    diff: '',
    body: '## What changed\n\nremoved a.test.ts on purpose\n\n## Tests changed\n\nnone\n',
  });
  assert.equal(r.declared, false);
});

test('the declaration runs to end of body when it is the last section', () => {
  const r = findings({
    nameStatus: 'D\tsrc/a.test.ts\n',
    diff: '',
    body: '## Evidence\n\nx\n\n## Tests changed\n\nRemoved a.test.ts: obsolete.',
  });
  assert.equal(r.declared, true);
});

test('the unedited PR template does not declare anything', () => {
  const template = readFileSync(new URL('../../pull_request_template.md', import.meta.url), 'utf8');
  const r = findings({ nameStatus: 'D\tsrc/a.test.ts\n', diff: '', body: template });
  assert.equal(r.declared, false);
  assert.equal(r.ok, false);
});

test('HTML comments and "none"-like text do not declare', () => {
  for (const text of [
    '<!-- Removed a.test.ts, it is obsolete -->',
    'None.',
    '`none`',
    '- none',
    'N/A',
    'n/a',
    '* None',
  ]) {
    const r = findings({ nameStatus: 'D\tsrc/a.test.ts\n', diff: '', body: declared(text) });
    assert.equal(r.declared, false, text);
  }
});

test('more skip, only and todo forms are findings', () => {
  for (const line of [
    "it.only.each([1])('x', () => {});",
    "describe.skip.each([1])('x', () => {});",
    "it.skipIf(cond)('x', () => {});",
    "test('x', { skip: true }, () => {});",
    "fit('x', () => {});",
    "  fdescribe('x', () => {});",
    "test.todo('x');",
    "it.fails('x', () => {});",
  ]) {
    const diff = fileDiff('src/a.test.ts', [`+${line}`]);
    const r = findings({ nameStatus: 'M\tsrc/a.test.ts\n', diff, body: NO_BODY });
    assert.equal(r.items[0]?.kind, 'skip-marker-added', line);
  }
});

test('a function called fit in the middle of a line is not a skip marker', () => {
  const diff = fileDiff('src/a.test.ts', ['+  const model = fit(data);']);
  const r = findings({ nameStatus: 'M\tsrc/a.test.ts\n', diff, body: NO_BODY });
  assert.deepEqual(r.items, []);
});

test('expect.soft counts as an assertion and comment lines do not', () => {
  const removed = fileDiff('src/a.test.ts', ['-  expect.soft(a).toBe(1);', '+  // expect(a).toBe(1);']);
  const r = findings({ nameStatus: 'M\tsrc/a.test.ts\n', diff: removed, body: NO_BODY });
  assert.equal(r.items[0]?.kind, 'assertions-removed');
  assert.equal(r.items[0]?.detail, '1');
});

test('no findings is ok without a declaration', () => {
  const r = findings({ nameStatus: 'M\tsrc/a.ts\n', diff: '', body: '' });
  assert.deepEqual(r.items, []);
  assert.equal(r.declared, false);
  assert.equal(r.ok, true);
});

test('tolerates a null body and CRLF line endings', () => {
  const r = findings({
    nameStatus: 'D\tsrc/a.test.ts\r\n',
    diff: '',
    body: '## Tests changed\r\n\r\nRemoved: obsolete\r\n',
  });
  assert.equal(r.declared, true);
  assert.equal(findings({ nameStatus: '', diff: '', body: null }).ok, true);
});

const cli = fileURLToPath(new URL('./integrity.mjs', import.meta.url));

function git(cwd, ...args) {
  const res = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr);
  return res.stdout;
}

function fixtureRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'integrity-'));
  git(dir, 'init', '-q', '-b', 'main');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/a.test.ts'), "it('x', () => { expect(1).toBe(1); });\n");
  writeFileSync(join(dir, 'src/a.ts'), 'export const a = 1;\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'topic');
  return dir;
}

function runCli(dir, body) {
  const bodyFile = join(dir, '..', `body-${Math.random().toString(16).slice(2)}.md`);
  writeFileSync(bodyFile, body);
  return spawnSync(process.execPath, [cli, '--base', 'main', '--head', 'topic', '--body-file', bodyFile], {
    cwd: dir,
    encoding: 'utf8',
  });
}

test('CLI exits 1 when a test file is deleted and nothing is declared', () => {
  const dir = fixtureRepo();
  git(dir, 'rm', '-q', 'src/a.test.ts');
  git(dir, 'commit', '-q', '-m', 'drop test');
  const res = runCli(dir, NO_BODY);
  assert.equal(res.status, 1);
  assert.equal(JSON.parse(res.stdout).items[0].kind, 'deleted-test-file');
});

test('CLI exits 0 when the deletion is declared', () => {
  const dir = fixtureRepo();
  git(dir, 'rm', '-q', 'src/a.test.ts');
  git(dir, 'commit', '-q', '-m', 'drop test');
  const res = runCli(dir, declared('Removed a.test.ts: obsolete.'));
  assert.equal(res.status, 0);
  assert.equal(JSON.parse(res.stdout).declared, true);
});

test('CLI sees a skip marker added in a test file', () => {
  const dir = fixtureRepo();
  writeFileSync(join(dir, 'src/a.test.ts'), "it.skip('x', () => { expect(1).toBe(1); });\n");
  git(dir, 'commit', '-q', '-am', 'skip');
  const res = runCli(dir, NO_BODY);
  assert.equal(res.status, 1);
  assert.equal(JSON.parse(res.stdout).items[0].kind, 'skip-marker-added');
});

test('CLI is ok for a change that touches no tests', () => {
  const dir = fixtureRepo();
  writeFileSync(join(dir, 'src/a.ts'), 'export const a = 2;\n');
  git(dir, 'commit', '-q', '-am', 'change');
  const res = runCli(dir, NO_BODY);
  assert.equal(res.status, 0);
});

test('CLI exits 1 on missing arguments', () => {
  const res = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
  assert.equal(res.status, 1);
});
