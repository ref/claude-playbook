import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { REVIEWED_BY_RE, VERDICT_RE } from './verdict.mjs';

const skill = readFileSync(new URL('../../skills/review/SKILL.md', import.meta.url), 'utf8');

function fencedBlocks(text) {
  return [...text.matchAll(/^```[^\n]*\n([\s\S]*?)^```$/gm)].map((m) => m[1].replace(/\n$/, ''));
}

test('the review skill has frontmatter with name and description', () => {
  const front = /^---\n([\s\S]*?)\n---\n/.exec(skill);
  assert.ok(front, 'frontmatter missing');
  assert.match(front[1], /^name: review$/m);
  assert.match(front[1], /^description: .+/m);
});

test('the review skill carries an example verdict that the grammar accepts', () => {
  const examples = fencedBlocks(skill).filter((block) => {
    const lines = block.split('\n');
    return REVIEWED_BY_RE.test(lines[0]) && VERDICT_RE.test(lines.at(-1));
  });
  assert.ok(examples.length >= 1, 'no example block starts with Reviewed-by and ends with VERDICT');
});

test('the review skill names the Not executed section', () => {
  assert.ok(skill.includes('## Not executed'));
});

test('the review skill uses REST only: no gh pr or gh issue commands', () => {
  assert.doesNotMatch(skill, /\bgh (pr|issue) /);
});
