import assert from 'node:assert/strict';
import { test } from 'node:test';

test('runs on Node 22 or newer', () => {
  const major = Number.parseInt(process.version.slice(1), 10);
  assert.ok(major >= 22, `expected Node 22 or newer, got ${process.version}`);
});
