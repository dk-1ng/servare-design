// Screenshots of the popup wireframes (issue #11) into docs/decisions/assets/0006-popup-layouts/.
// Needs the dev server: `pnpm dev -- --port=4180` in another terminal (or BASE_URL=...).
// Also prints how the tight action lines behave at +40% text (pseudo-locale).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.env['BASE_URL'] ?? 'http://127.0.0.1:4180';
const out = join(import.meta.dirname, '../docs/decisions/assets/0006-popup-layouts');
mkdirSync(out, { recursive: true });

const shots: { scene: string; lang: string; tall: boolean }[] = [
  { scene: 'one', lang: 'en', tall: false },
  { scene: 'bare', lang: 'en', tall: false },
  { scene: 'many', lang: 'en', tall: true },
  { scene: 'choices', lang: 'en', tall: false },
  { scene: 'active', lang: 'en', tall: true },
  { scene: 'active', lang: 'pseudo', tall: true },
  { scene: 'item', lang: 'en', tall: false },
  { scene: 'downloads', lang: 'en', tall: false },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
for (const variant of ['a', 'b', 'c']) {
  for (const { scene, lang, tall } of shots) {
    const query = `scene=${scene}&lang=${lang}&static=1${tall ? '&tall=1' : ''}`;
    await page.goto(`${base}/wireframes/popup-${variant}.html?${query}`);
    await page.waitForSelector('html[data-ready="true"]');
    const name = `${variant}-${scene}${lang === 'en' ? '' : `-${lang}`}.png`;
    await page.locator('#popup').screenshot({ path: join(out, name) });
    if (scene === 'active') {
      const report = await page.evaluate(() => {
        const lines = (node: Element): number => {
          const style = getComputedStyle(node);
          return Math.round(node.getBoundingClientRect().height / parseFloat(style.lineHeight));
        };
        const rows = [...document.querySelectorAll('.row')];
        return rows.map((row) => {
          const actions = row.querySelector('.actions');
          const step = row.querySelector('.step');
          const buttons = [...(actions?.querySelectorAll('button') ?? [])];
          const tops = new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top)));
          return {
            title: row.querySelector('.title')?.textContent.slice(0, 18) ?? '',
            height: Math.round(row.getBoundingClientRect().height),
            buttonLines: tops.size,
            stepLines: step ? lines(step) : 0,
            overflowX: row.scrollWidth > row.clientWidth,
          };
        });
      });
      console.info(`${variant} ${lang}`, JSON.stringify(report));
    }
  }
}
await browser.close();
