import { expect, test } from '@playwright/test';
import { openPage } from './support/page.ts';
import { trackRemoteRequests } from './support/network.ts';

test('page makes no request outside localhost', async ({ page }) => {
  const remote = trackRemoteRequests(page);
  await openPage(page, '/index.html');
  expect(remote).toEqual([]);
});

test('the guard catches an injected remote image', async ({ page }) => {
  const remote = trackRemoteRequests(page);
  await page.route('https://example.invalid/**', (route) => route.abort());
  await openPage(page, '/index.html');
  await page.evaluate(() => {
    const img = document.createElement('img');
    img.src = 'https://example.invalid/pixel.png';
    document.body.append(img);
  });
  await expect.poll(() => remote.length).toBeGreaterThan(0);
});
