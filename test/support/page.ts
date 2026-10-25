import type { Page } from '@playwright/test';

export type Theme = 'light' | 'dark';
export type Locale = 'en' | 'pt_BR' | 'pseudo';
/** Popup/sidebar width and options/history width. */
export type Width = 380 | 1024;

export interface OpenOptions {
  /** Mock scenario name (resolved by the mock client once it exists). */
  scenario?: string;
  theme?: Theme;
  width?: Width;
  locale?: Locale;
}

/** Opens a prototype page (e.g. `index.html`) with scenario, theme, width and locale applied. */
export async function openPage(page: Page, path: string, options: OpenOptions = {}): Promise<void> {
  const { scenario = 'default', theme = 'light', width = 1024, locale = 'en' } = options;
  await page.setViewportSize({ width, height: width === 380 ? 600 : 800 });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  const query = new URLSearchParams({ scenario, theme, locale });
  await page.goto(`${path}?${query.toString()}`);
  await page.waitForSelector('html[data-ready="true"]');
}
