// PR shape: a conventional title (it becomes the squash-commit title), exactly one kind of
// issue link, the six template headings, and filled sections. Dependabot PRs are checked
// for the title only.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const TITLE_RE = /^(feat|fix|chore|docs|refactor|perf|test|ci|build|revert)(\([a-z0-9._/-]+\))?!?: \S.*$/;
const HEADINGS = [
  'What changed',
  'How to test by hand',
  'Evidence',
  'Tests changed',
  'Docs',
  'Risk nearby',
];
const MUST_BE_FILLED = ['How to test by hand', 'Evidence', 'Tests changed', 'Docs'];
const CLOSES_RE = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?) +#\d+/i;
const REFS_RE = /\brefs? +#\d+/i;
const NO_ISSUE_RE = /\bno[ -]issue\b/i;
const DEPENDABOT_BODY_RE = /^\s*(?:Bumps |Updates the requirements on )/m;

// Section name -> trimmed content; headings inside fenced code blocks do not count.
function parseSections(body) {
  const sections = new Map();
  let current = null;
  let fenced = false;
  const preamble = [];
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const heading = !fenced && /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      current = heading[1];
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    (current === null ? preamble : sections.get(current)).push(line);
  }
  const trimmed = new Map();
  for (const [name, lines] of sections) trimmed.set(name, lines.join('\n').trim());
  return { sections: trimmed, preamble: preamble.join('\n') };
}

export function check({ title, body }) {
  const problems = [];
  const titleText = String(title ?? '').trim();
  if (!TITLE_RE.test(titleText)) {
    problems.push(
      `PR title must be a conventional commit (it becomes the squash-commit title), e.g. "feat(feed): ..." — got "${titleText}"`,
    );
  }

  const text = String(body ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '');
  if (DEPENDABOT_BODY_RE.test(text) && /^(?:chore|build)\(deps(?:-dev)?\)/.test(titleText)) {
    return { ok: problems.length === 0, problems };
  }

  const { sections } = parseSections(text);

  const kinds = [CLOSES_RE, REFS_RE, NO_ISSUE_RE].filter((re) => re.test(text)).length;
  if (kinds === 0) {
    problems.push('PR body must link its issue: "Closes #<n>", "Refs #<n>" or "No issue"');
  } else if (kinds > 1) {
    problems.push(
      'PR body must carry exactly one kind of issue link: "Closes #<n>", "Refs #<n>" or "No issue"',
    );
  }

  for (const heading of HEADINGS) {
    if (!sections.has(heading)) problems.push(`PR body is missing the section "## ${heading}"`);
  }
  for (const heading of MUST_BE_FILLED) {
    if (sections.has(heading) && sections.get(heading) === '') {
      problems.push(`PR body section "## ${heading}" is empty`);
    }
  }

  const docs = sections.get('Docs');
  if (docs) {
    const first = docs.split('\n').find((line) => line.trim() !== '').trim();
    const bullets = /^\* \S/.test(first);
    const none = /^docs:\s*none\s*[—–-]+\s*\S.{2,}$/i.test(first);
    if (!bullets && !none) {
      problems.push(
        'PR body section "## Docs" must be "* <file> — <what changed>" bullets or "Docs: none — <reason>"',
      );
    }
  }

  return { ok: problems.length === 0, problems };
}

function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) break;
    args[argv[i].slice(2)] = argv[i + 1];
  }
  if (!args['title-file'] || !args['body-file']) {
    console.error('usage: hygiene.mjs --title-file <file> --body-file <file>');
    return 1;
  }
  const result = check({
    title: readFileSync(args['title-file'], 'utf8'),
    body: readFileSync(args['body-file'], 'utf8'),
  });
  for (const problem of result.problems) console.error(`::error::${problem}`);
  if (result.ok) console.log('PR title and body are well-formed.');
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
