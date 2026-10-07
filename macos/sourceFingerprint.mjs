/** Content identity for the inputs shipped by build-mac; no Git or source code execution. */
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const roots = ['src', 'server', 'macos', 'scripts', 'public', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.build.json', 'vite.config.ts', 'atelier-dark.png'];
export async function sourceFingerprint(root) {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  if (pkg.name !== 'agent-atelier') throw new Error('Not Atelier source.');
  const hash = createHash('sha256');
  let count = 0, bytes = 0;
  async function visit(relative, optional = false) {
    const file = join(root, relative);
    const info = await lstat(file).catch(error => { if (optional && error.code === 'ENOENT') return null; throw error; });
    if (!info) return;
    if (info.isSymbolicLink()) throw new Error('Source symlinks are unsupported.');
    if (info.isDirectory()) {
      for (const name of (await readdir(file)).sort()) {
        if (['node_modules', 'build', 'dist', '.git'].includes(name) || name.startsWith('.') || /(?:\.test\.[^.]+|\.md|\.log)$/.test(name)) continue;
        await visit(`${relative}/${name}`);
      }
    } else if (info.isFile()) {
      if (++count > 10000 || (bytes += info.size) > 64 * 1024 * 1024) throw new Error('Source is too large to check.');
      const data = await readFile(file);
      hash.update(`${relative}\0${data.length}\0`); hash.update(data);
    }
  }
  for (const name of roots) await visit(name, name === 'public');
  return hash.digest('hex');
}

export async function updateAvailable(source, installed) {
  if (typeof installed !== 'string' || !/^[a-f0-9]{64}$/.test(installed)) return null;
  try { return await sourceFingerprint(source) !== installed; } catch { return null; }
}
