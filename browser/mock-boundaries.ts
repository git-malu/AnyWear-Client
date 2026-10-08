import { expect, type Page } from '@playwright/test';

const unexpectedRequests = new WeakMap<Page, string[]>();

/** Block external calls unless a scenario installs an explicit mock. */
export async function mockClientBoundaries(page: Page) {
  const unexpected: string[] = [];
  unexpectedRequests.set(page, unexpected);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://localhost:1420') return route.continue();
    unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
    return route.abort('blockedbyclient');
  });
  await page.route('https://example.com/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />',
  }));
}

export function expectOnlyMockedCalls(page: Page) {
  expect(unexpectedRequests.get(page), 'unexpected Service/cloud calls').toEqual([]);
}
