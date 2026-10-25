// i18n for the prototype. `t()` mirrors the `browser.i18n.getMessage` signature so the real
// API can replace it in Servare without touching call sites. Messages are WebExtensions
// `messages.json` files under prototype/_locales/<locale>/.
import { pseudoLocalize } from './pseudo.ts';

export type Locale = 'en' | 'pt_BR' | 'pseudo';

export const LOCALES: readonly Locale[] = ['en', 'pt_BR', 'pseudo'];
const DEFAULT_LOCALE = 'en' satisfies Locale;
const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);

interface RawMessage {
  message: string;
  description?: string;
  placeholders?: Record<string, { content: string; example?: string }>;
}

let messages: ReadonlyMap<string, string> = new Map();
let current: Locale = DEFAULT_LOCALE;

/** Reads `?lang=` (falls back to `en`). */
export function localeFromUrl(search: string = location.search): Locale {
  const lang = new URLSearchParams(search).get('lang');
  return LOCALES.find((locale) => locale === lang) ?? DEFAULT_LOCALE;
}

/** Resolves named placeholders (`$NAME$`) to positional tokens (`$1`); `$$` stays escaped. */
function resolve({ message, placeholders = {} }: RawMessage): string {
  const byName = new Map(
    Object.entries(placeholders).map(([k, v]) => [k.toLowerCase(), v.content]),
  );
  return message.replace(
    /\$([A-Za-z0-9_@]+)\$/g,
    (whole, name: string) => byName.get(name.toLowerCase()) ?? whole,
  );
}

async function load(locale: Exclude<Locale, 'pseudo'>): Promise<Map<string, string>> {
  const url = new URL(`_locales/${locale}/messages.json`, document.baseURI);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load ${url.pathname}: ${String(response.status)}`);
  const raw = (await response.json()) as Record<string, RawMessage>;
  return new Map(Object.entries(raw).map(([key, value]) => [key, resolve(value)]));
}

/** Same contract as `browser.i18n.getMessage`: unknown key → empty string. */
export function t(key: string, substitutions?: string | readonly string[]): string {
  const template = messages.get(key);
  if (template === undefined) return '';
  const values = typeof substitutions === 'string' ? [substitutions] : (substitutions ?? []);
  return template.replace(/\$([1-9$])/g, (_, token: string) =>
    token === '$' ? '$' : (values[Number(token) - 1] ?? ''),
  );
}

/** Fills static markup: `data-i18n="key"` sets the text; `data-i18n-attr="aria-label:key;title:key"` sets attributes. */
export function applyTranslations(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset['i18n'] ?? '');
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-attr]')) {
    for (const pair of (el.dataset['i18nAttr'] ?? '').split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
}

/** Active locale as a BCP 47 language tag (`pt_BR` → `pt-BR`; `pseudo` → `en-XA`). */
export function languageTag(locale: Locale = current): string {
  return locale === 'pseudo' ? 'en-XA' : locale.replace('_', '-');
}

/** Loads messages, sets `lang`/`dir` on `<html>` and fills `data-i18n` markup. */
export async function initI18n(locale: Locale = localeFromUrl()): Promise<void> {
  current = locale;
  if (locale === 'pseudo') {
    const base = await load(DEFAULT_LOCALE);
    messages = new Map([...base].map(([key, value]) => [key, pseudoLocalize(value)]));
  } else {
    messages = await load(locale);
  }
  const tag = languageTag(locale);
  document.documentElement.lang = tag;
  document.documentElement.dir = RTL_LANGUAGES.has(tag.split('-')[0] ?? '') ? 'rtl' : 'ltr';
  applyTranslations();
}
