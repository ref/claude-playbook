// Waits on one pull request head and reports the first decisive outcome: `red` as soon as
// any check or status fails (a reviewer blocker included), `green` once every required
// check passed, `timeout` when the wait outlives its limit. The `ship` skill runs it in the
// background after every push and acts on the one JSON line it prints. REST only
// (`gh api`), so it works in cloud sessions, where the proxy blocks GraphQL.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// The five merge gates of AGENTS.md "Getting to the trunk".
export const REQUIRED = ['checks', 'pr-hygiene', 'security', 'test-integrity', 'review-verdict'];

const FAILED = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);
const PASSED = new Set(['success', 'neutral', 'skipped']);

// review-verdict marks a head nobody has reviewed yet `pending`, or `failure` with this
// description in older copies of the workflow: either way the reviewer is still to come.
const NO_VERDICT_RE = /^no verdict for /;
const BLOCKER_RE = /^blocker for /;

// checkRuns: the head's check runs (REST shape). statuses: the latest status per context,
// as the combined-status endpoint returns them.
export function classify({ checkRuns, statuses, required = REQUIRED }) {
  // A re-run is a new check run with the same name; only the latest one counts.
  const latest = new Map();
  for (const run of checkRuns) {
    const seen = latest.get(run.name);
    if (!seen || run.id > seen.id) latest.set(run.name, run);
  }
  const passed = new Set();
  const failed = [];
  for (const run of latest.values()) {
    if (run.status !== 'completed') continue;
    if (FAILED.has(run.conclusion)) {
      failed.push({ name: run.name, kind: 'check', description: run.conclusion, url: run.html_url ?? '' });
    } else if (PASSED.has(run.conclusion)) {
      passed.add(run.name);
    }
  }
  for (const status of statuses) {
    if (status.state === 'success') {
      passed.add(status.context);
      continue;
    }
    if (status.state !== 'failure' && status.state !== 'error') continue;
    const description = status.description ?? '';
    const isVerdict = status.context === 'review-verdict';
    if (isVerdict && NO_VERDICT_RE.test(description)) continue;
    const kind = isVerdict && BLOCKER_RE.test(description) ? 'blocker' : 'status';
    failed.push({ name: status.context, kind, description, url: status.target_url ?? '' });
  }
  const pending = required.filter((name) => !passed.has(name));
  const outcome = failed.length > 0 ? 'red' : pending.length === 0 ? 'green' : 'pending';
  return { outcome, failed, pending };
}

// api: { pull(pr) -> { state, merged, headSha }, checkRuns(sha), statuses(sha) }; any of
// them may throw. sha: the head this wait is for; while the PR shows another head (GitHub
// not caught up with the push yet) nothing is judged, and after movedGraceMs it is `moved`.
export async function waitFor({ pr, sha, api, sleep, now, intervalMs, timeoutMs, movedGraceMs, maxErrors = 5, log = () => {} }) {
  const start = now();
  let errors = 0;
  let mismatchSince = null;
  let pending = [...REQUIRED];
  let lastReport = '';
  for (;;) {
    try {
      const pull = await api.pull(pr);
      errors = 0;
      if (pull.state !== 'open') return { outcome: 'closed', merged: Boolean(pull.merged), pr, sha: pull.headSha };
      if (sha && pull.headSha !== sha) {
        mismatchSince ??= now();
        if (now() - mismatchSince >= movedGraceMs) return { outcome: 'moved', pr, sha: pull.headSha, expected: sha };
      } else {
        mismatchSince = null;
        const result = classify({ checkRuns: await api.checkRuns(pull.headSha), statuses: await api.statuses(pull.headSha) });
        if (result.outcome !== 'pending') return { ...result, pr, sha: pull.headSha };
        pending = result.pending;
        const report = `waiting for ${pending.join(', ')}`;
        if (report !== lastReport) log(report);
        lastReport = report;
      }
    } catch (error) {
      errors += 1;
      log(`GitHub API error ${errors}/${maxErrors}: ${error.message}`);
      if (errors >= maxErrors) return { outcome: 'error', pr, sha: sha ?? null, description: error.message };
    }
    if (now() - start >= timeoutMs) return { outcome: 'timeout', pr, sha: sha ?? null, pending };
    await sleep(intervalMs);
  }
}

function gh(args) {
  const r = spawnSync('gh', ['api', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || `gh api exited with ${r.status}`).trim());
  return r.stdout;
}

const restApi = {
  pull(pr) {
    const p = JSON.parse(gh([`repos/{owner}/{repo}/pulls/${pr}`]));
    return { state: p.state, merged: p.merged, headSha: p.head.sha };
  },
  checkRuns(sha) {
    const out = gh([
      '--paginate',
      `repos/{owner}/{repo}/commits/${sha}/check-runs?per_page=100`,
      '--jq',
      '.check_runs[] | {id, name, status, conclusion, html_url}',
    ]);
    return out.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  },
  statuses(sha) {
    return JSON.parse(gh([`repos/{owner}/{repo}/commits/${sha}/status`])).statuses;
  },
};

const USAGE = 'usage: wait.mjs --pr <number> [--sha <head sha>] [--interval <seconds, 30>] [--timeout <minutes, 30>]';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key.startsWith('--') || argv[i + 1] === undefined) return null;
    args[key.slice(2)] = argv[i + 1];
  }
  return args;
}

async function main(argv) {
  const args = parseArgs(argv);
  const pr = Number(args?.pr);
  const interval = Number(args?.interval ?? 30);
  const timeout = Number(args?.timeout ?? 30);
  if (!Number.isInteger(pr) || pr <= 0 || !(interval > 0) || !(timeout > 0)) {
    console.error(USAGE);
    return 2;
  }
  const result = await waitFor({
    pr,
    sha: args.sha,
    api: restApi,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    intervalMs: interval * 1000,
    timeoutMs: timeout * 60_000,
    movedGraceMs: 3 * 60_000,
    log: (line) => console.error(`pr-wait: ${line}`),
  });
  console.log(JSON.stringify(result));
  return result.outcome === 'green' ? 0 : result.outcome === 'red' ? 1 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
