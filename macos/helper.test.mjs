import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { get } from 'node:http';
import { mkdtemp, writeFile, readFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const helper = fileURLToPath(new URL('./helper.mjs', import.meta.url));
const deadline = (promise) => Promise.race([promise, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Timed out')), 6000); timer.unref(); })]);
async function unusedPort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}
async function launch(t, port, extraEnv = {}) {
  const folder = await mkdtemp(join(tmpdir(), 'atelier-helper-'));
  const registry = join(folder, 'projects.json');
  await writeFile(registry, JSON.stringify({ projects: [{ id: 'test', name: 'Test', origin: null, repo: folder }] }));
  const child = spawn(process.execPath, [helper, String(port)], { env: { ...process.env, ATELIER_PROJECTS: registry, ...extraEnv }, stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.on('data', data => { out += data; }); child.stderr.on('data', data => { err += data; });
  const exit = once(child, 'exit');
  t.after(async () => { if (child.exitCode === null) { child.stdin.end(); child.kill('SIGTERM'); await deadline(exit); } await rm(folder, { recursive: true, force: true }); });
  return { child, exit, output: () => out, error: () => err, registry };
}
async function ready(run) {
  while (!run.output().includes('"ready":true')) {
    if (run.child.exitCode !== null) throw new Error(run.error());
    await deadline(Promise.race([once(run.child.stdout, 'data'), run.exit.then(() => { throw new Error(run.error()); })]));
  }
}

test('owned helper serves the bundle, preserves API boundaries and exits on parent pipe EOF', async t => {
  const port = await unusedPort(); const run = await launch(t, port); await ready(run);
  const url = `http://localhost:${port}`;
  assert.equal((await fetch(url)).status, 200);
  const list = await fetch(`${url}/__atelier/projects`, { headers: { 'sec-fetch-site': 'same-origin' } });
  assert.equal(list.status, 200); assert.equal((await list.json()).projects[0].id, 'test');
  for (const site of ['same-site', 'cross-site', 'none', '']) {
    assert.equal((await fetch(`${url}/__atelier/projects`, { headers: site ? { 'sec-fetch-site': site } : {} })).status, 403);
  }
  const hostileHost = await new Promise((resolve, reject) => { get(url, { headers: { host: `example.com:${port}` } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject); });
  assert.equal(hostileHost, 403);
  run.child.stdin.end();
  assert.equal((await deadline(run.exit))[0], 0);
  await assert.rejects(fetch(url));
});

test('occupied port fails without adopting or stopping the existing listener', async t => {
  const port = await unusedPort(); const owner = createServer(socket => socket.end());
  owner.listen(port, '127.0.0.1'); await once(owner, 'listening');
  t.after(() => new Promise(resolve => owner.close(resolve)));
  const run = await launch(t, port);
  assert.equal((await deadline(run.exit))[0], 1);
  assert.match(run.error(), /already in use/); assert.equal(run.output(), ''); assert.equal(owner.listening, true);
});

test('SIGTERM releases both loopback listeners', async t => {
  const port = await unusedPort(); const run = await launch(t, port); await ready(run);
  run.child.kill('SIGTERM'); assert.equal((await deadline(run.exit))[0], 0);
  const next = await launch(t, port); await ready(next); next.child.stdin.end(); await deadline(next.exit);
});


test('shutdown reaps in-flight Git commands, including one ignoring SIGTERM', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'atelier-git-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const pids = join(folder, 'pids');
  const fakeGit = join(folder, 'git');
  await writeFile(fakeGit, `#!${process.execPath}\nimport('node:fs').then(fs => { fs.appendFileSync(process.env.TEST_PIDS, process.pid + '\\n'); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000); });\n`);
  await chmod(fakeGit, 0o755);
  const port = await unusedPort();
  const run = await launch(t, port, { PATH: folder, TEST_PIDS: pids }); await ready(run);
  const request = fetch(`http://localhost:${port}/__atelier/branches/test`, { headers: { 'sec-fetch-site': 'same-origin' } }).catch(() => null);
  let children = [];
  await deadline((async () => {
    while (children.length < 2) {
      children = (await readFile(pids, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(Number);
      if (children.length < 2) await new Promise(resolve => setTimeout(resolve, 20));
    }
  })());
  run.child.stdin.end(); assert.equal((await deadline(run.exit))[0], 0);
  await request;
  for (const pid of children) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});

for (const phase of ['preparing', 'ready']) {
  test(`parent pipe EOF stops owned branch previews while ${phase}`, { skip: process.platform !== 'darwin' }, async t => {
    const { execFileSync } = await import('node:child_process');
    const { dirname } = await import('node:path');
    const port = await unusedPort(); const run = await launch(t, port);
    const repo = dirname(run.registry);
    const pidFile = join(repo, 'owned-child');
    const manifest = { atelier: 1, name: 'Fixture', frame: { width: 800, height: 600 }, groups: [] };
    await writeFile(join(repo, 'server.mjs'), `import {createServer} from 'node:http'; import {writeFileSync} from 'node:fs'; writeFileSync(process.env.PID_FILE,String(process.pid)); createServer((q,r)=>{r.setHeader('content-type','application/json');r.end(${JSON.stringify(JSON.stringify(manifest))})}).listen(Number(process.argv[2]),'127.0.0.1');`);
    const git = (...args) => execFileSync('/usr/bin/git', args, { cwd: repo, stdio: 'pipe' });
    git('init', '-q', '-b', 'main'); git('add', 'server.mjs'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Fixture');
    await writeFile(run.registry, JSON.stringify({ projects: [{ id: 'test', repo, preview: { dir: '.', requires: ['server.mjs'], prepare: phase === 'ready' ? [] : [[process.execPath, '-e', "require('fs').writeFileSync(process.env.PID_FILE,String(process.pid)); process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"]], start: [process.execPath, 'server.mjs', '{port}'], env: { PID_FILE: pidFile } } }] }));
    await ready(run);
    const url = `http://localhost:${port}/__atelier/previews`;
    const headers = { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', origin: `http://localhost:${port}` };
    const state = await (await fetch(url, { headers })).json();
    assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify({ action: 'start', projectId: 'test', branch: 'main', instance: state.instance, revision: state.revision }) })).status, 202);
    let pid, active;
    await deadline((async () => {
      while (!pid || (phase === 'ready' && !active)) {
        pid = await readFile(pidFile, 'utf8').then(Number, () => null);
        active = (await (await fetch(url, { headers })).json()).active;
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    })());
    run.child.stdin.end(); assert.equal((await deadline(run.exit))[0], 0);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    if (active) await assert.rejects(fetch(active.origin));
  });
}
