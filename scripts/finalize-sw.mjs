/* eslint-disable no-undef */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const dist = path.join(root, 'apps/web/dist');
const swPath = path.join(dist, 'sw.js');
if (!fs.existsSync(swPath)) throw new Error('dist/sw.js missing; run vite build first');
const files = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) walk(file);
    else if (path.relative(dist, file) !== 'sw.js') files.push(file);
  }
}
walk(dist);
files.sort();
const hash = crypto.createHash('sha256');
for (const file of files) hash.update(path.relative(dist, file)).update('\0').update(fs.readFileSync(file)).update('\0');
const version = hash.digest('hex').slice(0, 12);
const source = fs.readFileSync(swPath, 'utf8');
if (!source.includes('form-shell-v1') && !/form-shell-build-[a-f0-9]{12}/.test(source)) throw new Error('unexpected service-worker cache token');
const precache = ['/', '/today', ...files.map((file) => `/${path.relative(dist, file).replaceAll(path.sep, '/')}`).filter((file) => !file.endsWith('.map') && file !== '/test-utils.js')];
  const next = source.replace(/form-shell-(?:v1|build-[a-f0-9]{12})/g, `form-shell-build-${version}`).replace('__FORM_PRECACHE__', JSON.stringify(precache));
fs.writeFileSync(swPath, next);
console.log(`service-worker-cache=form-shell-build-${version}`);
