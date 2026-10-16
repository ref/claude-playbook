// Evaluates the executing reviewer's verdict for a pull request head.
// Grammar: line 1 `Reviewed-by: claude/<model>, head <sha>`, last line
// `VERDICT: approve` or `VERDICT: blocker`.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REVIEWED_BY_RE = /^Reviewed-by: claude\/([^\s,]+), head ([^\s,]+)$/;
export const VERDICT_RE = /^VERDICT: (approve|blocker)$/;

// Line 1 and the last non-blank line of the body, without trailing whitespace; null when
// the body does not follow the grammar.
function parseVerdict(body) {
  const lines = String(body ?? '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  while (lines.length && lines.at(-1) === '') lines.pop();
  if (lines.length < 2) return null;
  const first = REVIEWED_BY_RE.exec(lines[0]);
  const last = VERDICT_RE.exec(lines.at(-1));
  if (!first || !last) return null;
  return { sha: first[2], verdict: last[1] };
}

export function evaluate({ comments, headSha, reviewerLogins, patchIds }) {
  const reviewers = new Set(reviewerLogins.map((login) => login.trim().toLowerCase()));
  const headPatch = patchIds?.[headSha];
  const effective = [];
  comments.forEach((comment, index) => {
    if (!reviewers.has(String(comment.login ?? '').trim().toLowerCase())) return;
    // Anyone with Write access can edit another user's comment: an edited comment is not
    // evidence of what the reviewer wrote. The reviewer never edits; it posts a new comment.
    if (comment.updatedAt && Date.parse(comment.updatedAt) > Date.parse(comment.createdAt)) return;
    const parsed = parseVerdict(comment.body);
    if (!parsed) return;
    const samePatch = Boolean(headPatch) && patchIds[parsed.sha] === headPatch;
    if (parsed.sha !== headSha && !samePatch) return;
    effective.push({ ...parsed, time: Date.parse(comment.createdAt) || 0, index });
  });
  effective.sort((a, b) => a.time - b.time || a.index - b.index);
  const latest = effective.at(-1);
  if (!latest) {
    return { ok: false, state: 'none', sha: null, reason: `no verdict for ${headSha}` };
  }
  const carried = latest.sha !== headSha;
  if (latest.verdict === 'approve') {
    return {
      ok: true,
      state: 'approve',
      sha: latest.sha,
      reason: carried ? `approve carried from ${latest.sha}` : `approve for ${latest.sha}`,
    };
  }
  return { ok: false, state: 'blocker', sha: latest.sha, reason: `blocker for ${latest.sha}` };
}

// Accepts both the normalized shape and the REST shape of an issue comment.
function normalizeComment(c) {
  return {
    login: c.login ?? c.user?.login ?? '',
    body: c.body ?? '',
    createdAt: c.createdAt ?? c.created_at ?? '',
    updatedAt: c.updatedAt ?? c.updated_at ?? '',
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key.startsWith('--') || argv[i + 1] === undefined) return null;
    args[key.slice(2)] = argv[i + 1];
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (!args?.head || !args.reviewers || !args.comments || !args['patch-ids']) {
    console.error(
      'usage: verdict.mjs --head <sha> --reviewers a,b --comments <json-file> --patch-ids <json-file>',
    );
    return 1;
  }
  const comments = JSON.parse(readFileSync(args.comments, 'utf8')).map(normalizeComment);
  const patchIds = JSON.parse(readFileSync(args['patch-ids'], 'utf8'));
  const result = evaluate({
    comments,
    headSha: args.head,
    reviewerLogins: args.reviewers.split(',').map((login) => login.trim()).filter(Boolean),
    patchIds,
  });
  console.log(JSON.stringify(result));
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
