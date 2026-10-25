// Runs only the screenshot specs. Set SCREENS_DIR=<issue> to save under test/screenshots/<issue>/.
import { spawnSync } from 'node:child_process';

const result = spawnSync('pnpm', ['exec', 'playwright', 'test', 'screens'], {
  stdio: 'inherit',
  env: { ...process.env, SCREENS: '1' },
});
process.exit(result.status ?? 1);
