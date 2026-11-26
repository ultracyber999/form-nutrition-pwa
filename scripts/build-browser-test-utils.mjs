/* eslint-disable no-undef */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const esbuildDir = fs.readdirSync(path.join(root, 'node_modules/.pnpm')).find((name) => name.startsWith('esbuild@'));
if (!esbuildDir) throw new Error('esbuild package not found');
const bin = path.join(root, 'node_modules/.pnpm', esbuildDir, 'node_modules/esbuild/bin/esbuild');
fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
execFileSync(bin, [path.join(root, 'scripts/browser-test-utils-entry.js'), '--bundle', '--alias:@form/data=./packages/data/src/index.ts', '--alias:@form/test-data=./packages/test-data/src/index.ts', '--alias:@form/domain=./packages/domain/src/index.ts', '--alias:@form/contracts=./packages/contracts/src/index.ts', '--format=iife', '--platform=browser', '--target=es2022', `--outfile=${path.join(root, '.tmp/browser-test-utils.js')}`], { cwd: root, stdio: 'inherit' });
console.log('.tmp/browser-test-utils.js');
