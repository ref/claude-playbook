import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { brokenRefs, installedPath, placeholders, scanTemplates } from './check-templates.mjs';

const cli = fileURLToPath(new URL('./check-templates.mjs', import.meta.url));

test('placeholders finds {{TOKENS}} and ignores Actions expressions', () => {
  const text = 'branches: ["{{DEFAULT_BRANCH}}"]\nref: ${{ github.ref }}\nx: {{OTHER_1}} {{DEFAULT_BRANCH}}';
  assert.deepEqual([...placeholders(text)].sort(), ['{{DEFAULT_BRANCH}}', '{{OTHER_1}}']);
});

test('placeholders is empty for text without tokens', () => {
  assert.equal(placeholders('nothing here, ${{ secrets.X }}').size, 0);
});

test('brokenRefs reports referenced paths that do not exist', () => {
  const existing = new Set(['.agents/skills/review/SKILL.md', '.agents/skills/review', '.agents/skills', '.agents']);
  const text = [
    'See `.agents/skills/review/SKILL.md` and .agents/skills/missing/SKILL.md.',
    'Also .github/workflows/ci.yml and docs/RUNBOOK.md.',
  ].join('\n');
  assert.deepEqual(brokenRefs(text, existing).sort(), [
    '.agents/skills/missing/SKILL.md',
    '.github/workflows/ci.yml',
    'docs/RUNBOOK.md',
  ]);
});

test('brokenRefs accepts directories and ignores globs, placeholders and sentence punctuation', () => {
  const existing = new Set(['.agents/skills/review/SKILL.md', '.agents/skills/review', '.agents/skills', '.agents']);
  const text = [
    'in `.agents/skills/` and .agents/skills/review/SKILL.md.',
    'docs/** and .github/workflows/*.yml and .agents/skills/<name>/SKILL.md',
  ].join('\n');
  assert.deepEqual(brokenRefs(text, existing), []);
});

test('installedPath maps template files to their installed locations', () => {
  const cases = {
    'skills/review/SKILL.md': '.agents/skills/review/SKILL.md',
    'scripts/review-verdict/verdict.mjs': '.agents/scripts/review-verdict/verdict.mjs',
    'agents/routing.md': '.agents/routing.md',
    'agents/worker-brief.md': '.agents/worker-brief.md',
    'workflows/ci.yml': '.github/workflows/ci.yml',
    'githooks/pre-push': '.githooks/pre-push',
    'RUNBOOK.md': 'docs/RUNBOOK.md',
    'pull_request_template.md': '.github/pull_request_template.md',
    'dependabot.yml': '.github/dependabot.yml',
    'settings.json': '.claude/settings.json',
    'cloud-session-start.sh': '.agents/cloud-session-start.sh',
    worktreeinclude: '.worktreeinclude',
    'AGENTS.md': 'AGENTS.md',
    'CLAUDE.md': 'CLAUDE.md',
  };
  for (const [from, to] of Object.entries(cases)) assert.equal(installedPath(from), to, from);
});

test('installedPath is null for files that stay in this repository', () => {
  for (const p of ['scripts/smoke.test.mjs', 'scripts/check-templates.mjs', 'scripts/check-templates.test.mjs', 'cloud-setup.sh']) {
    assert.equal(installedPath(p), null, p);
  }
});

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'templates-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

test('scanTemplates flags a stray placeholder and a broken reference', () => {
  const dir = fixture({
    'AGENTS.md': 'branch {{PKG_MANAGER}}; see .agents/skills/nope/SKILL.md and docs/RUNBOOK.md',
    'RUNBOOK.md': 'ok',
  });
  const problems = scanTemplates(dir);
  assert.equal(problems.length, 2);
  assert.match(problems.join('\n'), /PKG_MANAGER/);
  assert.match(problems.join('\n'), /nope/);
});

test('scanTemplates accepts {{DEFAULT_BRANCH}} and whitelisted install-time paths', () => {
  const dir = fixture({
    'githooks/pre-push': 'branch={{DEFAULT_BRANCH}}\n',
    'AGENTS.md': 'see .agents/playbook.lock, .github/CODEOWNERS, docs/specs/ and docs/plans/ and .githooks/pre-push',
  });
  assert.deepEqual(scanTemplates(dir), []);
});

const goodSkill = (name) => `---\nname: ${name}\ndescription: Does a thing.\n---\n\nbody\n`;

test('scanTemplates requires skill frontmatter whose name matches the directory', () => {
  const dir = fixture({
    'skills/a/SKILL.md': goodSkill('a'),
    'skills/b/SKILL.md': goodSkill('other'),
    'skills/c/SKILL.md': '---\nname: c\n---\n',
    'skills/d/SKILL.md': 'no frontmatter',
  });
  const problems = scanTemplates(dir).join('\n');
  assert.doesNotMatch(problems, /skills\/a\//);
  assert.match(problems, /skills\/b\/SKILL\.md: .*name/);
  assert.match(problems, /skills\/c\/SKILL\.md: .*description/);
  assert.match(problems, /skills\/d\/SKILL\.md: .*frontmatter/);
});

test('scanTemplates keeps GraphQL gh subcommands out of every skill but status', () => {
  const dir = fixture({
    'skills/ship/SKILL.md': `${goodSkill('ship')}\nrun gh pr create\n`,
    'skills/status/SKILL.md': `${goodSkill('status')}\nrun gh pr list\n`,
  });
  const problems = scanTemplates(dir).join('\n');
  assert.match(problems, /skills\/ship\/SKILL\.md: .*gh api/);
  assert.doesNotMatch(problems, /skills\/status/);
});

test('CLI exits 1 on a broken template tree and 0 on the repository', () => {
  const broken = fixture({ 'AGENTS.md': '{{NOPE}}' });
  assert.equal(spawnSync(process.execPath, [cli, broken], { encoding: 'utf8' }).status, 1);
  const res = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
});
