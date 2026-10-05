// The app owns stdin: EOF means its window/process has gone away.
// Reuse the packaged server and its access checks; no native API bridge.
import { fileURLToPath } from 'node:url';
import { serve } from '../dist/server/serve.js';
import { projectsFile } from '../dist/server/projects.js';
import { cancelBranchReads } from '../dist/server/branches.js';

const port = Number(process.argv[2]);
let closing = false;
let closeServer;
let starting;
async function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 3500);
  deadline.unref();
  try { await starting; } catch { /* startup already reports its error */ }
  await Promise.all([closeServer?.(), cancelBranchReads()]);
  process.exit(0);
}
process.stdin.on('end', () => void shutdown());
process.stdin.on('error', () => void shutdown());
process.stdin.resume();
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) throw new Error('Atelier needs Node 22.12 or newer.');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid Atelier app port.');
  starting = serve({ root: fileURLToPath(new URL('../dist/app', import.meta.url)), port, file: projectsFile() });
  closeServer = await starting;
  if (!closing) process.stdout.write(JSON.stringify({ ready: true, port }) + '\n');
} catch (error) {
  const message = error?.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Atelier left the other process alone. Close the other copy or free that port, then reopen Atelier.`
    : error instanceof Error ? error.message : String(error);
  process.stderr.write(message + '\n');
  process.exit(1);
}
