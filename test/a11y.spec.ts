import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openPage, type Theme, type Width } from './support/page.ts';

const themes: Theme[] = ['light', 'dark'];
const widths: Width[] = [380, 1024];

for (const theme of themes) {
  for (const width of widths) {
    test(`placeholder has no serious axe violations (${theme}, ${String(width)}px)`, async ({
      page,
    }) => {
      await openPage(page, '/index.html', { theme, width });
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });
  }
}
