import { expect, test } from './support/fixtures.ts';
import { openPage, type Locale, type Theme, type Width } from './support/page.ts';

const pages = [
  { path: '/wireframes/options-states.html', states: 11 },
  { path: '/wireframes/history-states.html', states: 9 },
];

for (const { path, states } of pages) {
  test.describe(path, () => {
    test('renders every state at both widths; declared controls and coverage hold', async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await openPage(page, path);
      await expect(page.locator('figure.state')).toHaveCount(states);
      await expect(page.locator('.win.w1024').first()).toBeVisible();
      await expect(page.locator('.win.w380').first()).toBeVisible();
      await expect(page.locator('section#coverage table tbody tr').first()).toBeVisible();
      expect(errors).toEqual([]);
    });

    for (const locale of ['pt_BR', 'pseudo'] satisfies Locale[]) {
      test(`renders in ${locale} without errors`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await openPage(page, path, { locale });
        await expect(page.locator('figure.state').first()).toBeVisible();
        expect(errors).toEqual([]);
      });
    }

    test('no frame text is missing a translation', async ({ page }) => {
      await openPage(page, path);
      const empty = await page
        .locator('.win button, .win label, .win h2')
        .evaluateAll(
          (nodes) =>
            nodes.filter((n) => !n.textContent.trim() && !n.getAttribute('aria-label')).length,
        );
      // Icon-only buttons carry aria-label; labels and headings must have text.
      expect(empty).toBe(0);
    });
  });
}

const themes: Theme[] = ['light', 'dark'];
const widths: Width[] = [380, 1024];
test.describe('screenshots', () => {
  test.skip(!process.env['SCREENS'], 'screenshots only with pnpm test:screens');
  for (const theme of themes) {
    for (const width of widths) {
      for (const name of ['options', 'history']) {
        test(`${name} wireframes ${theme} ${String(width)}`, async ({ page }, info) => {
          await openPage(page, `/wireframes/${name}-states.html`, { theme, width });
          await page.screenshot({
            path: `test/screenshots/${process.env['SCREENS_DIR'] ?? 'local'}/${info.project.name}/wireframes-${name}-${theme}-${String(width)}.png`,
            fullPage: true,
          });
        });
      }
    }
  }
});
