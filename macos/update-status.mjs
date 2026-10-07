import { updateAvailable } from './sourceFingerprint.mjs';
// Called only by the native host, with its saved source folder and bundled identity.
process.stdout.write(JSON.stringify({ available: await updateAvailable(process.argv[2], process.argv[3]) }));
