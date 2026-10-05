import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, rename, readdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { checkSource, stageBundle, replaceBundle, waitForExit } from './update.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'atelier-update-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'Installed.app'), candidate = join(root, 'New.app');
  for (const [folder, version] of [[target, 'old'], [candidate, 'new']]) {
    await mkdir(folder); await writeFile(join(folder, 'version'), version);
  }
  return { root, target, candidate };
}
const version = path => readFile(join(path, 'version'), 'utf8');

test('stages and verifies before replacing; preserves a recoverable previous bundle', async t => {
  const { target, candidate } = await fixture(t);
  const stage = await stageBundle(candidate, target, async app => assert.equal(await version(app), 'new'));
  assert.equal(await version(target), 'old');
  await replaceBundle(target, stage, async app => assert.equal(await version(app), 'new'));
  assert.equal(await version(target), 'new');
  assert.equal(await version(stage.backup), 'old');
});

test('failed verification leaves the installed app unchanged and removes staging', async t => {
  const { root, target, candidate } = await fixture(t);
  await assert.rejects(stageBundle(candidate, target, () => { throw new Error('invalid signature'); }), /invalid signature/);
  assert.equal(await version(target), 'old');
  assert.deepEqual((await readdir(root)).sort(), ['Installed.app', 'New.app']);
});

test('replacement failure rolls back without losing the old app', async t => {
  const { target, candidate } = await fixture(t);
  const stage = await stageBundle(candidate, target, () => {});
  let launched = false;
  await assert.rejects(replaceBundle(target, stage, () => { launched = true; }, (from, to) => {
    if (from === stage.staged) throw new Error('disk failure');
    return rename(from, to);
  }), /disk failure/);
  assert.equal(await version(target), 'old');
  assert.equal(launched, false);
});

test('launch failure restores the previous app and retains the failed build', async t => {
  const { target, candidate } = await fixture(t);
  const stage = await stageBundle(candidate, target, () => {});
  await assert.rejects(replaceBundle(target, stage, () => { throw new Error('launch failed'); }), /launch failed/);
  assert.equal(await version(target), 'old');
  assert.equal(await version(join(stage.folder, 'Failed.app')), 'new');
});

test('refuses unrelated sources and updating a running build output in place', async t => {
  const { root, target } = await fixture(t);
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'other-project' }));
  await assert.rejects(checkSource(root, target), /not an Atelier/);
  await assert.rejects(checkSource(root, join(root, 'macos/build/Atelier.app')), /outside its build folder/);
});

test('waits for both owned processes and times out without killing any process', async () => {
  const child = spawn(process.execPath, ['-e', 'setTimeout(()=>{},100)']);
  await waitForExit([child.pid]);
  await assert.rejects(waitForExit([process.pid], 20), /did not quit/);
  assert.doesNotThrow(() => process.kill(process.pid, 0));
});

test('a worker launched through a path alias reports build failure before any quit or replacement', async t => {
  const { root, target } = await fixture(t);
  await mkdir(join(root, 'scripts'));
  await mkdir(join(root, 'node_modules/typescript'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'agent-atelier', scripts: { 'build:mac': 'node scripts/build-mac.mjs' } }));
  await writeFile(join(root, 'scripts/build-mac.mjs'), 'throw new Error("broken source fixture");');
  const alias = join(root, 'worker-alias.mjs');
  await symlink(new URL('./update.mjs', import.meta.url).pathname, alias);
  const worker = spawn(process.execPath, [alias, root, target, String(process.pid), String(process.pid), join(root, 'report.json')], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = ''; worker.stdout.on('data', chunk => { out += chunk; });
  const [code] = await once(worker, 'exit');
  assert.equal(code, 1);
  assert.match(JSON.parse(out).error, /broken source fixture/);
  assert.equal(await version(target), 'old');
});

test('closing the app during a build cancels its build process group without replacing it', async t => {
  const { root, target } = await fixture(t);
  await mkdir(join(root, 'scripts'));
  await mkdir(join(root, 'node_modules/typescript'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'agent-atelier', scripts: { 'build:mac': 'node scripts/build-mac.mjs' } }));
  const pidFile = join(root, 'build-pid');
  await writeFile(join(root, 'scripts/build-mac.mjs'), `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(()=>{},1000);`);
  const worker = spawn(process.execPath, [new URL('./update.mjs', import.meta.url).pathname, root, target, String(process.pid), String(process.pid), join(root, 'report.json')], { stdio: ['pipe', 'pipe', 'pipe'] });
  const exit = once(worker, 'exit');
  t.after(() => { if (worker.exitCode === null) worker.kill(); });
  let pid;
  for (let i = 0; i < 100 && !pid; i++) {
    pid = Number(await readFile(pidFile, 'utf8').catch(() => ''));
    if (!pid) await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.ok(pid, 'build started');
  worker.stdin.end();
  assert.equal((await exit)[0], 1);
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  assert.equal(await version(target), 'old');
});
