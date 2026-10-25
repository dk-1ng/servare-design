import type { Page } from '@playwright/test';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Collects every request the page makes that leaves localhost (MV3 CSP forbids them). */
export function trackRemoteRequests(page: Page): string[] {
  const remote: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const local =
      url.protocol === 'file:' ||
      url.protocol === 'data:' ||
      url.protocol === 'blob:' ||
      LOCAL_HOSTS.has(url.hostname);
    if (!local) remote.push(request.url());
  });
  return remote;
}
