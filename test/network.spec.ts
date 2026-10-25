import { openPage } from './support/page.ts';
import { expect, test } from './support/fixtures.ts';

// The guard itself is an automatic fixture (support/fixtures.ts) that runs in every spec.
test('page makes no request outside localhost', async ({ page, remoteRequests }) => {
  await openPage(page, '/index.html');
  expect(remoteRequests).toEqual([]);
});

test.describe('guard canary', () => {
  test.use({ allowRemote: true });

  test('the guard catches an injected remote image', async ({ page, remoteRequests }) => {
    await page.route('https://example.invalid/**', (route) => route.abort());
    await openPage(page, '/index.html');
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.src = 'https://example.invalid/pixel.png';
      document.body.append(img);
    });
    await expect.poll(() => remoteRequests.length).toBeGreaterThan(0);
  });
});
