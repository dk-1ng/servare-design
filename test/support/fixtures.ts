import { expect, test as base } from '@playwright/test';
import { trackRemoteRequests } from './network.ts';

interface Options {
  /** Set to true only in tests that provoke a remote request on purpose. */
  allowRemote: boolean;
}

interface Fixtures {
  remoteRequests: string[];
  guardRemote: undefined;
}

/** `test` with an automatic guard: any request outside localhost fails the test, in every spec. */
export const test = base.extend<Options & Fixtures>({
  allowRemote: [false, { option: true }],
  remoteRequests: async ({ page }, use) => {
    await use(trackRemoteRequests(page));
  },
  guardRemote: [
    async ({ page, remoteRequests, allowRemote }, use) => {
      await use(undefined);
      // Late requests (fonts, lazy images) start after the page reports ready.
      await page.waitForLoadState('networkidle');
      if (!allowRemote) expect(remoteRequests, 'remote requests').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
