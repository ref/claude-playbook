import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { evaluate } from './verdict.mjs';

const REVIEWER = 'reviewer-bot';

function verdictBody(sha, verdict) {
  return `Reviewed-by: claude/opus-5-5, head ${sha}\n\nlooked at it\n\nVERDICT: ${verdict}`;
}

function comment(sha, verdict, { login = REVIEWER, createdAt = '2026-10-16T10:00:00Z' } = {}) {
  return { login, body: verdictBody(sha, verdict), createdAt };
}

function run(comments, { headSha = 'shaA', patchIds = {} } = {}) {
  return evaluate({ comments, headSha, reviewerLogins: [REVIEWER], patchIds });
}

test('approve for the head passes', () => {
  const r = run([comment('shaA', 'approve')]);
  assert.equal(r.ok, true);
  assert.equal(r.state, 'approve');
  assert.equal(r.sha, 'shaA');
  assert.equal(r.reason, 'approve for shaA');
});

test('blocker for the head fails', () => {
  const r = run([comment('shaA', 'blocker')]);
  assert.equal(r.ok, false);
  assert.equal(r.state, 'blocker');
  assert.equal(r.reason, 'blocker for shaA');
});

test('no verdict fails with reason "no verdict for <sha>"', () => {
  const r = run([]);
  assert.equal(r.ok, false);
  assert.equal(r.state, 'none');
  assert.equal(r.sha, null);
  assert.equal(r.reason, 'no verdict for shaA');
});

test('ignores verdict-shaped comments from other logins', () => {
  const r = run([comment('shaA', 'approve', { login: 'agent-bot' })]);
  assert.equal(r.ok, false);
  assert.equal(r.state, 'none');
});

test('latest verdict for the head wins', () => {
  const r = run([
    comment('shaA', 'approve', { createdAt: '2026-10-16T10:00:00Z' }),
    comment('shaA', 'blocker', { createdAt: '2026-10-16T11:00:00Z' }),
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.state, 'blocker');
});

test('an edited comment is not a verdict', () => {
  const edited = { ...comment('shaA', 'approve'), updatedAt: '2026-10-16T10:05:00Z' };
  const r = run([edited]);
  assert.equal(r.ok, false);
  assert.equal(r.state, 'none');
});

test('editing an approve cannot overwrite an earlier blocker', () => {
  const r = run([
    comment('shaA', 'blocker', { createdAt: '2026-10-16T10:00:00Z' }),
    { ...comment('shaA', 'approve', { createdAt: '2026-10-16T09:00:00Z' }), updatedAt: '2026-10-16T12:00:00Z' },
  ]);
  assert.equal(r.state, 'blocker');
});

test('a comment whose updatedAt equals createdAt is a verdict', () => {
  const same = { ...comment('shaA', 'approve'), updatedAt: '2026-10-16T10:00:00Z' };
  assert.equal(run([same]).ok, true);
});

test('reviewer logins are trimmed', () => {
  const r = evaluate({
    comments: [comment('shaA', 'approve', { login: 'other-bot' })],
    headSha: 'shaA',
    reviewerLogins: [' reviewer-bot ', ' other-bot'],
    patchIds: {},
  });
  assert.equal(r.ok, true);
});

test('latest verdict wins regardless of input order', () => {
  const r = run([
    comment('shaA', 'blocker', { createdAt: '2026-10-16T11:00:00Z' }),
    comment('shaA', 'approve', { createdAt: '2026-10-16T10:00:00Z' }),
  ]);
  assert.equal(r.state, 'blocker');
});

test('carries approve across identical patch-id', () => {
  const r = run([comment('shaA', 'approve')], {
    headSha: 'shaB',
    patchIds: { shaA: 'p1', shaB: 'p1' },
  });
  assert.equal(r.ok, true);
  assert.equal(r.sha, 'shaA');
  assert.match(r.reason, /carried/);
});

test('does not carry across different patch-id', () => {
  const r = run([comment('shaA', 'approve')], {
    headSha: 'shaB',
    patchIds: { shaA: 'p1', shaB: 'p2' },
  });
  assert.equal(r.ok, false);
  assert.equal(r.state, 'none');
});

test('does not carry when a patch-id is missing', () => {
  const r = run([comment('shaA', 'approve')], { headSha: 'shaB', patchIds: { shaB: 'p1' } });
  assert.equal(r.ok, false);
});

test('a later blocker for an older identical-content sha beats an earlier approve for the head', () => {
  const r = run(
    [
      comment('shaB', 'approve', { createdAt: '2026-10-16T10:00:00Z' }),
      comment('shaA', 'blocker', { createdAt: '2026-10-16T11:00:00Z' }),
    ],
    { headSha: 'shaB', patchIds: { shaA: 'p1', shaB: 'p1' } },
  );
  assert.equal(r.state, 'blocker');
});

test('malformed Reviewed-by line is not a verdict', () => {
  const r = run([
    {
      login: REVIEWER,
      body: 'Reviewed-by: claude/opus-5-5\n\nVERDICT: approve',
      createdAt: '2026-10-16T10:00:00Z',
    },
  ]);
  assert.equal(r.state, 'none');
});

test('a verdict that is not the last line is not a verdict', () => {
  const r = run([
    {
      login: REVIEWER,
      body: 'Reviewed-by: claude/opus-5-5, head shaA\n\nVERDICT: approve\n\nand also this',
      createdAt: '2026-10-16T10:00:00Z',
    },
  ]);
  assert.equal(r.state, 'none');
});

test('a comment that only quotes the grammar mid-body is not a verdict', () => {
  const r = run([
    {
      login: REVIEWER,
      body: 'note: Reviewed-by: claude/x, head shaA\nand VERDICT: approve\nthanks',
      createdAt: '2026-10-16T10:00:00Z',
    },
  ]);
  assert.equal(r.state, 'none');
});

test('tolerates CRLF line endings and trailing whitespace', () => {
  const r = run([
    {
      login: REVIEWER,
      body: 'Reviewed-by: claude/opus-5-5, head shaA\r\n\r\nok\r\n\r\nVERDICT: approve  \r\n',
      createdAt: '2026-10-16T10:00:00Z',
    },
  ]);
  assert.equal(r.ok, true);
});

test('a Not executed section does not break the grammar', () => {
  const body =
    'Reviewed-by: claude/opus-5-5, head shaA\n\n## Not executed\n- e2e suite: no browser\n\nVERDICT: approve';
  const r = run([{ login: REVIEWER, body, createdAt: '2026-10-16T10:00:00Z' }]);
  assert.equal(r.ok, true);
});

test('login comparison ignores case', () => {
  const r = evaluate({
    comments: [comment('shaA', 'approve', { login: 'Reviewer-Bot' })],
    headSha: 'shaA',
    reviewerLogins: ['reviewer-bot'],
    patchIds: {},
  });
  assert.equal(r.ok, true);
});

const cli = fileURLToPath(new URL('./verdict.mjs', import.meta.url));

function runCli(comments, extra = []) {
  const dir = mkdtempSync(join(tmpdir(), 'verdict-'));
  const commentsFile = join(dir, 'comments.json');
  const patchFile = join(dir, 'patch-ids.json');
  writeFileSync(commentsFile, JSON.stringify(comments));
  writeFileSync(patchFile, JSON.stringify({}));
  return spawnSync(
    process.execPath,
    [cli, '--head', 'shaA', '--reviewers', REVIEWER, '--comments', commentsFile, '--patch-ids', patchFile, ...extra],
    { encoding: 'utf8' },
  );
}

test('CLI exits 1 on blocker', () => {
  const res = runCli([comment('shaA', 'blocker')]);
  assert.equal(res.status, 1);
  assert.equal(JSON.parse(res.stdout).state, 'blocker');
});

test('CLI exits 0 on approve and prints JSON', () => {
  const res = runCli([comment('shaA', 'approve')]);
  assert.equal(res.status, 0);
  assert.equal(JSON.parse(res.stdout).ok, true);
});

test('CLI accepts the REST comment shape (user.login, body, created_at)', () => {
  const rest = [
    {
      user: { login: REVIEWER },
      body: verdictBody('shaA', 'approve'),
      created_at: '2026-10-16T10:00:00Z',
    },
  ];
  const res = runCli(rest);
  assert.equal(res.status, 0);
});

test('CLI ignores an edited comment in the REST shape (updated_at after created_at)', () => {
  const rest = [
    {
      user: { login: REVIEWER },
      body: verdictBody('shaA', 'approve'),
      created_at: '2026-10-16T10:00:00Z',
      updated_at: '2026-10-16T10:01:00Z',
    },
  ];
  assert.equal(runCli(rest).status, 1);
});

test('CLI exits 1 on missing arguments', () => {
  const res = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
  assert.equal(res.status, 1);
});
