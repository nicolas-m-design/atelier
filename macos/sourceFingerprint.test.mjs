import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, utimes, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceFingerprint, updateAvailable } from './sourceFingerprint.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'atelier-fingerprint-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ['src', 'server', 'macos', 'scripts']) await mkdir(join(root, name));
  for (const name of ['index.html', 'package-lock.json', 'tsconfig.json', 'tsconfig.build.json', 'vite.config.ts', 'atelier-dark.png']) await writeFile(join(root, name), 'fixture');
  await writeFile(join(root, 'package.json'), '{"name":"agent-atelier"}');
  await writeFile(join(root, 'src/app.ts'), 'first');
  return root;
}

test('saved code changes, additions and deletions change identity; timestamps and commits do not', async t => {
  const root = await fixture(t), first = await sourceFingerprint(root);
  assert.equal(await updateAvailable(root, first), false);
  await utimes(join(root, 'src/app.ts'), new Date(), new Date(0));
  assert.equal(await sourceFingerprint(root), first);
  await writeFile(join(root, 'src/app.ts'), 'second');
  assert.equal(await updateAvailable(root, first), true);
  await writeFile(join(root, 'src/app.ts'), 'first');
  await writeFile(join(root, 'src/new.ts'), 'new');
  assert.equal(await updateAvailable(root, first), true);
  await rm(join(root, 'src/new.ts'));
  assert.equal(await updateAvailable(root, first), false);
});

test('docs, tests, builds and dependencies do not trigger an update', async t => {
  const root = await fixture(t), first = await sourceFingerprint(root);
  for (const path of ['macos/build', 'src/node_modules', 'dist', '.git']) {
    await mkdir(join(root, path), { recursive: true }); await writeFile(join(root, path, 'output'), 'changed');
  }
  for (const path of ['TODOS.md', 'macos/README.md', 'macos/worker.test.mjs']) await writeFile(join(root, path), 'changed');
  assert.equal(await sourceFingerprint(root), first);
});

test('missing source, wrong repository, missing marker and symlinks are unknown, never current', async t => {
  const root = await fixture(t), first = await sourceFingerprint(root);
  assert.equal(await updateAvailable(root, undefined), null);
  assert.equal(await updateAvailable(join(root, 'missing'), first), null);
  await writeFile(join(root, 'package.json'), '{"name":"another-project"}');
  assert.equal(await updateAvailable(root, first), null);
  await writeFile(join(root, 'package.json'), '{"name":"agent-atelier"}');
  await symlink('/tmp', join(root, 'src/external'));
  assert.equal(await updateAvailable(root, first), null);
});
