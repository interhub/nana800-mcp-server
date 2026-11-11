import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const testsDir = path.join(rootDir, 'tests');
const outDir = path.join(rootDir, '.test-dist');
const testFiles = fs.readdirSync(testsDir).filter((file) => file.endsWith('.test.ts'));
fs.rmSync(outDir, { recursive: true, force: true });
await esbuild.build({
  entryPoints: testFiles.map((file) => path.join(testsDir, file)),
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outdir: outDir,
  outExtension: { '.js': '.mjs' },
  packages: 'external',
  define: { __PACKAGE_VERSION__: '"test"' },
});
const result = spawnSync(process.execPath, ['--test', ...fs.readdirSync(outDir).map((file) => path.join(outDir, file))], { stdio: 'inherit' });
fs.rmSync(outDir, { recursive: true, force: true });
process.exit(result.status ?? 1);
