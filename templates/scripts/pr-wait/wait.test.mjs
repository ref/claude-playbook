import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { REQUIRED, classify, waitFor } from './wait.mjs';

const SHA = 'a'.repeat(40);

function run(name, conclusion, id = 1) {
  return conclusion === null
    ? { id, name, status: 'in_progress', conclusion: null, html_url: `https://ci/${name}/${id}` }
    : { id, name, status: 'completed', conclusion, html_url: `https://ci/${name}/${id}` };
}

function verdict(state, description) {
  return { context: 'review-verdict', state, description, target_url: '' };
}

const GREEN_RUNS = ['checks', 'pr-hygiene', 'security', 'test-integrity'].map((n) => run(n, 'success'));
const APPROVED = verdict('success', `approve for ${SHA}`);

test('the required list is the five merge gates', () => {
  assert.deepEqual(REQUIRED, ['checks', 'pr-hygiene', 'security', 'test-integrity', 'review-verdict']);
});

test('every required check passed: green', () => {
  const r = classify({ checkRuns: GREEN_RUNS, statuses: [APPROVED] });
  assert.equal(r.outcome, 'green');
  assert.deepEqual(r.failed, []);
  assert.deepEqual(r.pending, []);
});

test('green needs every required check, not just one passing run', () => {
  const r = classify({ checkRuns: [run('checks', 'success')], statuses: [APPROVED] });
  assert.equal(r.outcome, 'pending');
  assert.deepEqual(r.pending, ['pr-hygiene', 'security', 'test-integrity']);
});

test('no review-verdict status yet: pending on it', () => {
  const r = classify({ checkRuns: GREEN_RUNS, statuses: [] });
  assert.equal(r.outcome, 'pending');
  assert.deepEqual(r.pending, ['review-verdict']);
});

test('review-verdict pending (waiting for the reviewer): pending', () => {
  const r = classify({
    checkRuns: GREEN_RUNS,
    statuses: [verdict('pending', `no verdict for ${SHA}; waiting for the reviewer`)],
  });
  assert.equal(r.outcome, 'pending');
  assert.deepEqual(r.pending, ['review-verdict']);
});

test('an older workflow reports no verdict as failure: still pending, not red', () => {
  const r = classify({ checkRuns: GREEN_RUNS, statuses: [verdict('failure', `no verdict for ${SHA}`)] });
  assert.equal(r.outcome, 'pending');
  assert.deepEqual(r.failed, []);
});

test('a reviewer blocker is red with kind blocker', () => {
  const r = classify({ checkRuns: GREEN_RUNS, statuses: [verdict('failure', `blocker for ${SHA}`)] });
  assert.equal(r.outcome, 'red');
  assert.deepEqual(
    r.failed.map((f) => [f.name, f.kind]),
    [['review-verdict', 'blocker']],
  );
});

test('a review-verdict failure that is not a verdict is red with kind status', () => {
  const r = classify({
    checkRuns: GREEN_RUNS,
    statuses: [verdict('failure', 'repository variable REVIEWER_LOGINS is not set')],
  });
  assert.equal(r.outcome, 'red');
  assert.equal(r.failed[0].kind, 'status');
});

test('one failed check is red at once, while the others still run', () => {
  const r = classify({
    checkRuns: [run('checks', 'failure'), run('security', null), run('pr-hygiene', 'success')],
    statuses: [],
  });
  assert.equal(r.outcome, 'red');
  assert.deepEqual(
    r.failed.map((f) => [f.name, f.kind, f.url]),
    [['checks', 'check', 'https://ci/checks/1']],
  );
  assert.deepEqual(r.pending, ['checks', 'security', 'test-integrity', 'review-verdict']);
});

test('timed_out, startup_failure and action_required are red too', () => {
  for (const conclusion of ['timed_out', 'startup_failure', 'action_required']) {
    const r = classify({ checkRuns: [...GREEN_RUNS, run('extra', conclusion, 9)], statuses: [APPROVED] });
    assert.equal(r.outcome, 'red', conclusion);
  }
});

test('a check outside the required list that fails is red', () => {
  const r = classify({ checkRuns: [...GREEN_RUNS, run('CodeQL', 'failure', 7)], statuses: [APPROVED] });
  assert.equal(r.outcome, 'red');
  assert.equal(r.failed[0].name, 'CodeQL');
});

test('a re-run that passed replaces the earlier failed run of the same name', () => {
  const r = classify({
    checkRuns: [...GREEN_RUNS.filter((c) => c.name !== 'checks'), run('checks', 'failure', 1), run('checks', 'success', 2)],
    statuses: [APPROVED],
  });
  assert.equal(r.outcome, 'green');
});

test('a re-run that failed replaces the earlier passed run of the same name', () => {
  const r = classify({
    checkRuns: [...GREEN_RUNS.filter((c) => c.name !== 'checks'), run('checks', 'success', 1), run('checks', 'failure', 2)],
    statuses: [APPROVED],
  });
  assert.equal(r.outcome, 'red');
});

test('a cancelled run is neither red nor passed', () => {
  const r = classify({
    checkRuns: [...GREEN_RUNS.filter((c) => c.name !== 'security'), run('security', 'cancelled', 3)],
    statuses: [APPROVED],
  });
  assert.equal(r.outcome, 'pending');
  assert.deepEqual(r.pending, ['security']);
});

test('skipped and neutral count as passed', () => {
  const runs = GREEN_RUNS.map((c) =>
    c.name === 'security' ? run('security', 'skipped') : c.name === 'checks' ? run('checks', 'neutral') : c,
  );
  assert.equal(classify({ checkRuns: runs, statuses: [APPROVED] }).outcome, 'green');
});

test('a commit status in error is red', () => {
  const r = classify({
    checkRuns: GREEN_RUNS,
    statuses: [APPROVED, { context: 'deploy/preview', state: 'error', description: 'boom', target_url: '' }],
  });
  assert.equal(r.outcome, 'red');
  assert.equal(r.failed[0].name, 'deploy/preview');
});

// A fake GitHub and a fake clock for waitFor. `polls` is one entry per poll:
// { pull, checkRuns, statuses } or { error }.
function harness(polls, { head = SHA } = {}) {
  let clock = 0;
  let i = 0;
  const current = () => polls[Math.min(i, polls.length - 1)];
  const sleeps = [];
  const api = {
    pull() {
      const p = current();
      if (p.error) throw new Error(p.error);
      return p.pull ?? { state: 'open', merged: false, headSha: head };
    },
    checkRuns() {
      return current().checkRuns ?? [];
    },
    statuses() {
      return current().statuses ?? [];
    },
  };
  return {
    api,
    sleeps,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
      i += 1;
    },
  };
}

const OPTS = { intervalMs: 30_000, timeoutMs: 30 * 60_000, movedGraceMs: 3 * 60_000 };

test('waitFor returns red on the first poll that shows a failure', async () => {
  const h = harness([{ checkRuns: [run('checks', 'failure')] }]);
  const r = await waitFor({ pr: 7, sha: SHA, ...h, ...OPTS });
  assert.equal(r.outcome, 'red');
  assert.equal(r.pr, 7);
  assert.equal(r.sha, SHA);
  assert.deepEqual(h.sleeps, []);
});

test('waitFor polls through pending until green', async () => {
  const h = harness([
    { checkRuns: [] },
    { checkRuns: GREEN_RUNS, statuses: [verdict('pending', 'no verdict')] },
    { checkRuns: GREEN_RUNS, statuses: [APPROVED] },
  ]);
  const r = await waitFor({ pr: 7, sha: SHA, ...h, ...OPTS });
  assert.equal(r.outcome, 'green');
  assert.deepEqual(h.sleeps, [30_000, 30_000]);
});

test('waitFor gives up with timeout and names what is still pending', async () => {
  const h = harness([{ checkRuns: GREEN_RUNS, statuses: [verdict('pending', 'no verdict')] }]);
  const r = await waitFor({ pr: 7, sha: SHA, ...h, ...OPTS });
  assert.equal(r.outcome, 'timeout');
  assert.deepEqual(r.pending, ['review-verdict']);
  assert.equal(h.sleeps.length, 60);
});

test('waitFor does not judge the old head while GitHub has not caught up with the push', async () => {
  const old = 'b'.repeat(40);
  const h = harness([
    { pull: { state: 'open', merged: false, headSha: old }, checkRuns: [run('checks', 'failure')] },
    { checkRuns: GREEN_RUNS, statuses: [APPROVED] },
  ]);
  const r = await waitFor({ pr: 7, sha: SHA, ...h, ...OPTS });
  assert.equal(r.outcome, 'green');
});

test('waitFor reports moved when the PR head stays on another sha', async () => {
  const other = 'c'.repeat(40);
  const h = harness([{ pull: { state: 'open', merged: false, headSha: other } }]);
  const r = await waitFor({ pr: 7, sha: SHA, ...h, ...OPTS });
  assert.equal(r.outcome, 'moved');
  assert.equal(r.sha, other);
  assert.equal(h.sleeps.length, 6);
});

test('waitFor stops on a closed or merged PR', async () => {
  for (const merged of [false, true]) {
    const h = harness([{ pull: { state: 'closed', merged, headSha: SHA } }]);
    const r = await waitFor({ pr: 7, sha: SHA, ...h, ...OPTS });
    assert.equal(r.outcome, 'closed');
    assert.equal(r.merged, merged);
  }
});

test('waitFor rides out a transient API error', async () => {
  const h = harness([{ error: 'HTTP 502' }, { checkRuns: GREEN_RUNS, statuses: [APPROVED] }]);
  const r = await waitFor({ pr: 7, sha: SHA, ...h, ...OPTS });
  assert.equal(r.outcome, 'green');
});

test('waitFor stops with error after five API failures in a row', async () => {
  const h = harness([{ error: 'HTTP 401: Bad credentials' }]);
  const r = await waitFor({ pr: 7, sha: SHA, ...h, ...OPTS });
  assert.equal(r.outcome, 'error');
  assert.match(r.description, /Bad credentials/);
  assert.equal(h.sleeps.length, 4);
});

test('the CLI refuses to run without --pr', () => {
  const script = fileURLToPath(new URL('./wait.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: wait\.mjs --pr <number>/);
});
