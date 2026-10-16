import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { check } from './hygiene.mjs';

const TITLE = 'feat(feed): add pagination';

function body(overrides = {}) {
  const sections = {
    link: 'Closes #12',
    'What changed': '* paginates the feed',
    'How to test by hand': '1. Open the feed\n2. Scroll to the bottom',
    Evidence: 'gate: 214 passed',
    'Tests changed': 'none',
    Docs: '* README.md — documents the page size',
    'Risk nearby': 'none',
    ...overrides,
  };
  const parts = [];
  if (sections.link !== null) parts.push(sections.link);
  for (const heading of [
    'What changed',
    'How to test by hand',
    'Evidence',
    'Tests changed',
    'Docs',
    'Risk nearby',
  ]) {
    if (sections[heading] === null) continue;
    parts.push(`## ${heading}\n\n${sections[heading]}`);
  }
  return parts.join('\n\n') + '\n';
}

test('a complete PR passes', () => {
  const r = check({ title: TITLE, body: body() });
  assert.deepEqual(r.problems, []);
  assert.equal(r.ok, true);
});

test('conventional title required', () => {
  assert.equal(check({ title: 'feat(x): y', body: body() }).ok, true);
  assert.equal(check({ title: 'fix: y', body: body() }).ok, true);
  assert.equal(check({ title: 'feat!: y', body: body() }).ok, true);
  for (const bad of ['Update stuff', 'feat: ', 'Feat: y', 'feature: y', '']) {
    const r = check({ title: bad, body: body() });
    assert.equal(r.ok, false, bad);
    assert.match(r.problems.join('\n'), /title/i);
  }
});

test('Closes, Refs and No issue each satisfy the issue link', () => {
  for (const link of ['Closes #12', 'Fixes #3', 'Refs #7', 'No issue']) {
    assert.equal(check({ title: TITLE, body: body({ link }) }).ok, true, link);
  }
});

test('no issue link fails', () => {
  const r = check({ title: TITLE, body: body({ link: null }) });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /issue/i);
});

test('two different kinds of issue link fail', () => {
  const r = check({ title: TITLE, body: body({ link: 'Closes #1\nRefs #2' }) });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /exactly one/i);
});

test('several Closes lines are one kind', () => {
  const r = check({ title: TITLE, body: body({ link: 'Closes #1\nCloses #2' }) });
  assert.equal(r.ok, true);
});

test('hint comments from the template do not count as an issue link', () => {
  const r = check({
    title: TITLE,
    body: body({ link: '<!-- Closes #<n>, Refs #<n> or No issue -->' }),
  });
  assert.equal(r.ok, false);
});

test('every required heading must be present', () => {
  for (const heading of [
    'What changed',
    'How to test by hand',
    'Evidence',
    'Tests changed',
    'Docs',
    'Risk nearby',
  ]) {
    const r = check({ title: TITLE, body: body({ [heading]: null }) });
    assert.equal(r.ok, false, heading);
    assert.match(r.problems.join('\n'), new RegExp(heading), heading);
  }
});

test('a heading followed directly by the next heading is a problem', () => {
  for (const heading of ['How to test by hand', 'Evidence', 'Tests changed', 'Docs']) {
    const r = check({ title: TITLE, body: body({ [heading]: '' }) });
    assert.equal(r.ok, false, heading);
    assert.match(r.problems.join('\n'), /empty/i, heading);
  }
});

test('a section holding only the template hint comment is empty', () => {
  const r = check({
    title: TITLE,
    body: body({ Evidence: '<!-- the gate output, tests added, screenshots -->' }),
  });
  assert.equal(r.ok, false);
});

test('What changed and Risk nearby may be empty', () => {
  const r = check({ title: TITLE, body: body({ 'What changed': '', 'Risk nearby': '' }) });
  assert.equal(r.ok, true);
});

test('Docs must be bullets or "Docs: none — <reason>"', () => {
  assert.equal(check({ title: TITLE, body: body({ Docs: '* a.md — b' }) }).ok, true);
  assert.equal(check({ title: TITLE, body: body({ Docs: 'Docs: none — internal refactor' }) }).ok, true);
  for (const bad of ['updated the readme', 'Docs: none —', 'Docs: none', '- a.md — b']) {
    const r = check({ title: TITLE, body: body({ Docs: bad }) });
    assert.equal(r.ok, false, bad);
    assert.match(r.problems.join('\n'), /Docs/, bad);
  }
});

test('headings inside fenced code blocks are not headings', () => {
  const r = check({
    title: TITLE,
    body: body({ Evidence: '```\n## Docs\n```' }),
  });
  assert.equal(r.ok, true);
});

test('a Dependabot PR is exempt from everything but the title', () => {
  const dependabot = 'Bumps [left-pad](https://example.invalid) from 1.0.0 to 1.0.1.\n';
  assert.equal(check({ title: 'chore(deps): bump left-pad from 1.0.0 to 1.0.1', body: dependabot }).ok, true);
  const r = check({ title: 'Bump left-pad', body: dependabot });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /title/i);
});

test('a non-Dependabot body does not earn the exemption', () => {
  const r = check({ title: 'chore(deps): bump left-pad from 1 to 2', body: 'bumped it\n' });
  assert.equal(r.ok, false);
});

test('tolerates a null body and CRLF line endings', () => {
  assert.equal(check({ title: TITLE, body: null }).ok, false);
  assert.equal(check({ title: TITLE, body: body().replace(/\n/g, '\r\n') }).ok, true);
});

const cli = fileURLToPath(new URL('./hygiene.mjs', import.meta.url));

function runCli(title, text) {
  const dir = mkdtempSync(join(tmpdir(), 'hygiene-'));
  writeFileSync(join(dir, 'title.txt'), title);
  writeFileSync(join(dir, 'body.md'), text);
  return spawnSync(
    process.execPath,
    [cli, '--title-file', join(dir, 'title.txt'), '--body-file', join(dir, 'body.md')],
    { encoding: 'utf8' },
  );
}

test('CLI exits 0 for a complete PR', () => {
  assert.equal(runCli(TITLE, body()).status, 0);
});

test('CLI exits 1 and lists problems', () => {
  const res = runCli('Update stuff', body({ link: null }));
  assert.equal(res.status, 1);
  assert.match(res.stderr, /title/i);
  assert.match(res.stderr, /issue/i);
});

test('CLI exits 1 on missing arguments', () => {
  assert.equal(spawnSync(process.execPath, [cli], { encoding: 'utf8' }).status, 1);
});
