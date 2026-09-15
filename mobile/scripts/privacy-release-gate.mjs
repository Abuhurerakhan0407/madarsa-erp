import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const generatedOnly = process.argv.includes('--generated');
const failures = [];

const fail = (message) => failures.push(message);
const read = (path) => readFileSync(path, 'utf8');

function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const info = statSync(path);
    if (info.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function inspectConfig(label, path, { production = false } = {}) {
  if (!existsSync(path)) {
    fail(`${label}: missing Capacitor config`);
    return;
  }
  const text = read(path);
  if (!/loggingBehavior\s*:\s*['"]none['"]/.test(text)) {
    fail(`${label}: native bridge logging must remain disabled`);
  }
  if (/allowMixedContent\s*:\s*true/.test(text)) {
    fail(`${label}: mixed HTTP/HTTPS content is forbidden`);
  }
  if (/webContentsDebuggingEnabled\s*:\s*true/.test(text)) {
    fail(`${label}: WebView debugging is forbidden for real-data builds`);
  }
  if (/cleartext\s*:\s*true/.test(text)) {
    fail(`${label}: cleartext network transport is forbidden`);
  }
  if (production && /server\s*:\s*\{[\s\S]*?\burl\s*:/.test(text)) {
    fail(`${label}: production must bundle the mobile UI; remote server.url is forbidden`);
  }
}

function inspectSourceSecrets() {
  const sourceRoot = join(root, 'src');
  const secretPatterns = [
    ['Supabase secret key name', /SUPABASE_SECRET_KEY/g],
    ['Supabase service-role key name', /SUPABASE_SERVICE_ROLE_KEY/g],
    ['private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ['live payment secret', /\bsk_live_[A-Za-z0-9_-]+/g],
  ];

  for (const path of walk(sourceRoot)) {
    if (!/\.(?:ts|tsx|js|jsx|mjs|json)$/.test(path)) continue;
    const text = read(path);
    for (const [name, pattern] of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        fail(`${relative(root, path)}: contains forbidden ${name}`);
      }
    }
  }
}

function inspectAndroidManifest() {
  const manifest = join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!existsSync(manifest)) {
    fail('generated AndroidManifest.xml is missing');
    return;
  }
  const text = read(manifest);

  if (!/android:allowBackup=['"]false['"]/.test(text)) {
    fail('Android manifest: application backup must be disabled for child/student data');
  }
  if (!/android:usesCleartextTraffic=['"]false['"]/.test(text)) {
    fail('Android manifest: cleartext traffic must be disabled');
  }

  const forbiddenPermissions = [
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.READ_CONTACTS',
    'android.permission.WRITE_CONTACTS',
    'android.permission.RECORD_AUDIO',
    'android.permission.READ_SMS',
    'android.permission.SEND_SMS',
    'android.permission.CALL_PHONE',
    'android.permission.READ_CALL_LOG',
    'android.permission.WRITE_CALL_LOG',
    'android.permission.MANAGE_EXTERNAL_STORAGE',
  ];

  for (const permission of forbiddenPermissions) {
    if (text.includes(permission)) {
      fail(`Android manifest: forbidden default permission ${permission}`);
    }
  }
}

if (!existsSync(join(root, 'DPDP_PRIVACY_RELEASE_GATE.md'))) {
  fail('DPDP_PRIVACY_RELEASE_GATE.md is missing');
}

if (generatedOnly) {
  inspectAndroidManifest();
} else {
  inspectConfig('production', join(root, 'capacitor.config.ts'), { production: true });
  inspectConfig('internal development', join(root, 'capacitor.config.dev.ts'));
  inspectSourceSecrets();
}

if (failures.length) {
  console.error('Ilmgaah privacy release gate FAILED:');
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`Ilmgaah privacy release gate passed (${generatedOnly ? 'generated Android' : 'source/config'}).`);
