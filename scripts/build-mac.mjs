import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
if (process.platform !== 'darwin') throw new Error('Build Atelier.app on a Mac with Xcode installed.');
run('npm', ['run', 'build']);
const app = join(root, 'macos/build/Atelier.app');
rmSync(app, { recursive: true, force: true });
const contents = join(app, 'Contents');
const resources = join(contents, 'Resources');
mkdirSync(join(contents, 'MacOS'), { recursive: true });
mkdirSync(join(resources, 'macos'), { recursive: true });
cpSync(join(root, 'dist'), join(resources, 'dist'), { recursive: true });
cpSync(join(root, 'macos/helper.mjs'), join(resources, 'macos/helper.mjs'));
cpSync(join(root, 'macos/update.mjs'), join(resources, 'macos/update.mjs'));
// Personal local build only; this metadata is not part of the npm package.
writeFileSync(join(resources, 'macos/source.json'), JSON.stringify({ path: root }));
cpSync(join(root, 'macos/Info.plist'), join(contents, 'Info.plist'));
const iconset = join(root, 'macos/build/Atelier.iconset');
rmSync(iconset, { recursive: true, force: true });
mkdirSync(iconset, { recursive: true });
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    const pixels = String(size * scale);
    run('sips', ['-z', pixels, pixels, join(root, 'atelier-dark.png'), '--out', join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`)]);
  }
}
run('iconutil', ['-c', 'icns', iconset, '-o', join(resources, 'Atelier.icns')]);
const { name, version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
writeFileSync(join(resources, 'package.json'), JSON.stringify({ name, version, type: 'module' }));
// Include the notices for assets compiled into the page.
for (const [name, file] of [['Inter-OFL', '@fontsource-variable/inter/LICENSE'], ['Lucide-ISC', 'lucide-react/LICENSE'], ['React-MIT', 'react/LICENSE']]) {
  cpSync(join(root, 'node_modules', file), join(resources, `${name}.txt`));
}
run('xcrun', ['swiftc', '-parse-as-library', '-O', '-swift-version', '5', '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos14.0`, '-framework', 'AppKit', '-framework', 'WebKit', 'macos/Atelier.swift', 'macos/LocalUpdate.swift', '-o', join(contents, 'MacOS/Atelier')]);
run('codesign', ['--force', '--sign', '-', app]);
console.log(`Built ${app}`);
