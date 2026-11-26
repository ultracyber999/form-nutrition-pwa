/* eslint-disable no-undef */
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const report = { checks: {} };
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const dist = path.join(root, 'apps/web/dist');
const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
const files = fs.readdirSync(path.join(dist, 'assets')).filter((file) => !file.endsWith('.map'));

function sourceToRegExp(source) {
  if (source.endsWith('(.*)')) {
    const prefix = source.slice(0, -4).replace(/[.*+?^${}|[\]\\]/g, '\\$&');
    return new RegExp(`^${prefix}.*$`);
  }
  return new RegExp(`^${source.replace(/[.*+?^${}|[\]\\]/g, '\\$&')}$`);
}
function effectiveHeader(pathname, key) {
  let value = null;
  for (const entry of config.headers ?? []) {
    if (!sourceToRegExp(entry.source).test(pathname)) continue;
    const header = entry.headers.find((row) => row.key.toLowerCase() === key.toLowerCase());
    if (header) value = header.value;
  }
  return value;
}

report.checks.vercelBuildShape = {
  status: config.installCommand?.includes('--frozen-lockfile') && config.buildCommand === 'corepack pnpm --filter @form/web build' && config.outputDirectory === 'apps/web/dist' ? 'PASS' : 'FAIL',
  installCommand: config.installCommand,
  buildCommand: config.buildCommand,
  outputDirectory: config.outputDirectory
};
report.checks.spaRewrite = { status: config.rewrites?.some((rule) => rule.source === '/(.*)' && rule.destination === '/index.html') ? 'PASS' : 'FAIL', rewrites: config.rewrites };
report.checks.securityHeaders = {
  status: ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy', 'cross-origin-resource-policy', 'strict-transport-security'].every((key) => effectiveHeader('/today', key)) ? 'PASS' : 'FAIL',
  csp: effectiveHeader('/today', 'content-security-policy')
};
report.checks.cachePolicy = {
  status: effectiveHeader('/sw.js', 'cache-control')?.includes('no-store') && effectiveHeader('/manifest.webmanifest', 'cache-control') === 'no-cache' && effectiveHeader('/assets/index-test.js', 'cache-control')?.includes('immutable') && effectiveHeader('/today', 'cache-control') === 'no-cache' ? 'PASS' : 'FAIL',
  sw: effectiveHeader('/sw.js', 'cache-control'),
  manifest: effectiveHeader('/manifest.webmanifest', 'cache-control'),
  asset: effectiveHeader('/assets/index-test.js', 'cache-control'),
  spaRoute: effectiveHeader('/today', 'cache-control')
};
report.checks.compiledAssetPrecache = {
  status: files.length > 0 && files.every((file) => sw.includes(`/assets/${file}`)) ? 'PASS' : 'FAIL',
  assets: files
};
report.checks.staticRuntimeBoundary = {
  status: !fs.existsSync(path.join(dist, 'test-utils.js')) && !sw.includes('https://') && !config.buildCommand?.includes('vercel dev') ? 'PASS' : 'FAIL',
  testUtilsPresent: fs.existsSync(path.join(dist, 'test-utils.js')),
  externalServiceWorkerReference: sw.includes('https://')
};
fs.writeFileSync(path.join(root, 'docs/evidence/deployment-config-validation-results.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.checks, null, 2));
if (Object.values(report.checks).some((check) => check.status !== 'PASS')) process.exitCode = 1;
