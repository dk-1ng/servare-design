import { test } from './support/fixtures.ts';
import { openPage, type Theme, type Width } from './support/page.ts';

// Run with `pnpm test:screens`; skipped in the regular suite.
test.skip(!process.env['SCREENS'], 'screenshots only with pnpm test:screens');

const themes: Theme[] = ['light', 'dark'];
const widths: Width[] = [380, 1024];

for (const theme of themes) {
  for (const width of widths) {
    test(`placeholder ${theme} ${String(width)}`, async ({ page }, info) => {
      await openPage(page, '/index.html', { theme, width });
      await page.screenshot({
        path: `test/screenshots/${process.env['SCREENS_DIR'] ?? 'local'}/${info.project.name}/placeholder-${theme}-${String(width)}.png`,
        fullPage: true,
      });
    });
  }
}
