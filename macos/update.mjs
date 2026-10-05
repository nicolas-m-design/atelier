/** Local-only update worker. Copied out of the app before it runs. No HTTP API. */
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { access, cp, lstat, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const bundleID = 'local.agent-atelier.mac';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function checkSource(source, target) {
  if (!source.startsWith('/') || !target.startsWith('/') || !target.endsWith('.app')) throw new Error('Use an absolute source folder and app path.');
  const candidate = join(source, 'macos/build/Atelier.app');
  if (resolve(candidate) === resolve(target)
    || await realpath(candidate).catch(() => resolve(candidate)) === await realpath(target)) throw new Error('Install Atelier outside its build folder before updating it.');
  const pkg = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  if (pkg.name !== 'agent-atelier' || pkg.scripts?.['build:mac'] !== 'node scripts/build-mac.mjs') throw new Error('This is not an Atelier source folder.');
  await access(join(source, 'scripts/build-mac.mjs'));
  await access(join(source, 'node_modules/typescript'));
  if ((await lstat(target)).isSymbolicLink()) throw new Error('The installed app must not be a symbolic link.');
  return candidate;
}

export function verifyBundle(app) {
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
  const id = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', join(app, 'Contents/Info.plist')], { encoding: 'utf8' }).trim();
  if (id !== bundleID) throw new Error('The update is not an Atelier app.');
}

/** Stage on the destination volume before quitting; rename and rollback stay local. */
export async function stageBundle(candidate, target, verify = verifyBundle) {
  const folder = await mkdtemp(join(dirname(target), '.atelier-update-'));
  const staged = join(folder, 'Atelier.app');
  try {
    await cp(candidate, staged, { recursive: true, dereference: false });
    await verify(staged);
    return { folder, staged, backup: join(folder, 'Previous.app') };
  } catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw error;
  }
}

export async function replaceBundle(target, stage, launch, move = rename) {
  await move(target, stage.backup);
  try {
    await move(stage.staged, target);
    await launch(target);
  } catch (error) {
    // Keep a failed new bundle for diagnosis, and restore the working one.
    try { await move(target, join(stage.folder, 'Failed.app')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    await move(stage.backup, target);
    throw error;
  }
}

export async function waitForExit(pids, timeout = 15000) {
  const until = Date.now() + timeout;
  while (pids.some(pid => { try { process.kill(pid, 0); return true; } catch (e) { if (e.code === 'ESRCH') return false; throw e; } })) {
    if (Date.now() >= until) throw new Error('Atelier did not quit in time. The installed app was not replaced.');
    await delay(100);
  }
}

async function main() {
  const [source, target, parentText, helperText, report] = process.argv.slice(2);
  const pids = [Number(parentText), Number(helperText)];
  if (pids.some(pid => !Number.isSafeInteger(pid) || pid <= 1) || !report?.startsWith('/')) throw new Error('Invalid updater arguments.');
  let authorized = false, closed = false, child, stage;
  const input = createInterface({ input: process.stdin });
  input.on('line', line => { if (line === 'install') authorized = true; });
  input.on('close', () => {
    closed = true;
    if (!authorized && child) {
      const group = child.pid;
      try { process.kill(-group, 'SIGTERM'); } catch {}
      setTimeout(() => { try { process.kill(-group, 'SIGKILL'); } catch {} }, 2000);
    }
  });
  const emit = value => { if (!closed) process.stdout.write(JSON.stringify(value) + '\n'); };
  // A closed parent pipe is cancellation until the native app explicitly authorizes install.
  process.stdout.on('error', () => {});
  try {
    const candidate = await checkSource(source, target);
    if (closed) throw new Error('Update cancelled because Atelier closed.');
    const npm = join(dirname(process.execPath), 'npm');
    let log = '';
    child = spawn(npm, ['run', 'build:mac'], {
      cwd: source, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, LANG: 'en_US.UTF-8',
        PATH: `${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin` },
    });
    const build = child;
    const append = data => { log = (log + data.toString()).slice(-12000); };
    build.stdout.on('data', append); build.stderr.on('data', append);
    const timer = setTimeout(() => { try { process.kill(-build.pid, 'SIGKILL'); } catch {} }, 10 * 60 * 1000);
    let code;
    try { [code] = await once(build, 'exit'); } finally { clearTimeout(timer); child = null; }
    if (closed) throw new Error('Update cancelled because Atelier closed.');
    if (code !== 0) throw new Error(`The local build failed. The installed app is unchanged.\n\n${log.slice(-3500)}`);
    stage = await stageBundle(candidate, target);
    emit({ ready: true });
    const until = Date.now() + 30000;
    while (!authorized && !closed && Date.now() < until) await delay(50);
    if (!authorized) throw new Error('Update cancelled before installation.');
    await waitForExit(pids);
    // Stop using the original stdout pipe before the parent goes away.
    const launch = app => execFileSync('/usr/bin/open', ['-n', app]);
    await replaceBundle(target, stage, launch);
    // Keep one previous bundle per update for manual recovery. Never touch WebKit data.
    await writeFile(report, JSON.stringify({ ok: true, backup: stage.backup }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!authorized) {
      emit({ error: message });
      if (stage) await rm(stage.folder, { recursive: true, force: true });
    } else {
      await writeFile(report, JSON.stringify({ ok: false, error: message }));
      // If the old process is gone, reopen the restored app to show the error.
      try { process.kill(pids[0], 0); } catch { try { execFileSync('/usr/bin/open', ['-n', target]); } catch {} }
    }
    process.exitCode = 1;
  } finally {
    input.close();
    process.stdin.destroy();
  }
}

// macOS aliases /var to /private/var; ESM resolves that alias but argv does not.
if (process.argv[1] && await realpath(process.argv[1]).catch(() => '') === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
}
