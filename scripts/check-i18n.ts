// Key-parity check for prototype/_locales: every locale has the same keys and the same
// placeholders, every message has a non-empty `description`, and every key referenced from
// markup (`data-i18n`) or code (`t('literal')`) exists. Exits 1 on any problem.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

interface Message {
  message?: unknown;
  description?: unknown;
  placeholders?: Record<string, unknown>;
}

const root = join(import.meta.dirname, '..');
const localesDir = join(root, 'prototype/_locales');
const sourceDir = join(root, 'prototype');
const REFERENCE = 'en';

const problems: string[] = [];
const catalogs = new Map<string, Record<string, Message>>();
for (const dir of readdirSync(localesDir, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const locale = dir.name;
  const file = join(localesDir, locale, 'messages.json');
  catalogs.set(locale, JSON.parse(readFileSync(file, 'utf8')) as Record<string, Message>);
}

const reference = catalogs.get(REFERENCE);
if (!reference) throw new Error(`Missing reference locale "${REFERENCE}"`);
const referenceKeys = new Set(Object.keys(reference));

for (const [locale, catalog] of catalogs) {
  for (const key of referenceKeys) {
    if (!(key in catalog)) problems.push(`${locale}: missing key "${key}"`);
  }
  for (const [key, entry] of Object.entries(catalog)) {
    if (!referenceKeys.has(key)) problems.push(`${locale}: extra key "${key}" not in ${REFERENCE}`);
    if (typeof entry.message !== 'string' || entry.message === '') {
      problems.push(`${locale}: "${key}" has no message`);
    }
    if (typeof entry.description !== 'string' || entry.description.trim() === '') {
      problems.push(`${locale}: "${key}" has no description`);
    }
    for (const [, name] of String(entry.message).matchAll(/\$([A-Za-z0-9_@]+)\$/g)) {
      const declared = Object.keys(entry.placeholders ?? {}).map((k) => k.toLowerCase());
      if (!declared.includes((name ?? '').toLowerCase())) {
        problems.push(`${locale}: "${key}" uses $${name ?? ''}$ without a matching placeholder`);
      }
    }
    const expected = Object.keys(reference[key]?.placeholders ?? {})
      .sort()
      .join(',');
    const actual = Object.keys(entry.placeholders ?? {})
      .sort()
      .join(',');
    if (reference[key] && expected !== actual) {
      problems.push(
        `${locale}: "${key}" placeholders [${actual}] differ from ${REFERENCE} [${expected}]`,
      );
    }
  }
}

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['dist', '_locales', 'node_modules'].includes(entry.name)) yield* sourceFiles(path);
    } else if (/\.(html|ts)$/.test(entry.name)) yield path;
  }
}

const usage = [/data-i18n="([^"]+)"/g, /data-i18n-attr="([^"]+)"/g, /\bt\(\s*'([^']+)'/g];
const loader = join(sourceDir, 'src/i18n/index.ts'); // its doc comments contain example markup
for (const file of sourceFiles(sourceDir)) {
  if (file === loader) continue;
  const text = readFileSync(file, 'utf8');
  const keys = [
    ...[...text.matchAll(usage[0] as RegExp)].map((m) => m[1] ?? ''),
    ...[...text.matchAll(usage[1] as RegExp)].flatMap((m) =>
      (m[1] ?? '').split(';').map((pair) => pair.split(':')[1]?.trim() ?? ''),
    ),
    ...[...text.matchAll(usage[2] as RegExp)].map((m) => m[1] ?? ''),
  ];
  for (const key of keys.filter(Boolean)) {
    if (!referenceKeys.has(key)) problems.push(`${relative(root, file)}: unknown key "${key}"`);
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.info(`i18n: ${String(referenceKeys.size)} keys OK in ${[...catalogs.keys()].join(', ')}`);
