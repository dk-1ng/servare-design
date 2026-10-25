// Bundles every prototype/src/pages/*.ts entry point into prototype/dist/.
// With --serve it also serves prototype/ on localhost and rebuilds on change.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as esbuild from 'esbuild';

const root = join(import.meta.dirname, '..');
const pagesDir = join(root, 'prototype/src/pages');

const options: esbuild.BuildOptions = {
  entryPoints: readdirSync(pagesDir)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join(pagesDir, file)),
  outdir: join(root, 'prototype/dist'),
  bundle: true,
  format: 'esm',
  target: 'es2023',
  sourcemap: true,
  logLevel: 'info',
};

if (process.argv.includes('--serve')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  // Bound to loopback only: nothing leaves the machine.
  const { hosts, port } = await ctx.serve({ servedir: join(root, 'prototype'), host: '127.0.0.1' });
  console.info(`Serving prototype at http://${hosts[0] ?? '127.0.0.1'}:${String(port)}/`);
} else {
  await esbuild.build(options);
}
