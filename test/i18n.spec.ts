import { expect, test } from './support/fixtures.ts';
import { openPage, type Locale } from './support/page.ts';

const expectations: Record<Locale, { lang: string; body: RegExp }> = {
  en: { lang: 'en', body: /^Placeholder page\./ },
  pt_BR: { lang: 'pt-BR', body: /^Página provisória\./ },
  pseudo: { lang: 'en-XA', body: /^\[.+~+\]$/ },
};

for (const [locale, expected] of Object.entries(expectations) as [
  Locale,
  (typeof expectations)[Locale],
][]) {
  test(`placeholder renders in ${locale}`, async ({ page }) => {
    await openPage(page, '/index.html', { locale });
    await expect(page.locator('html')).toHaveAttribute('lang', expected.lang);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('main p').first()).toHaveText(expected.body);
    await expect(page.locator('[data-role="locale"]')).toContainText(expected.lang);
  });
}
