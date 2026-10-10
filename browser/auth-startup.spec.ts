import { test, expect, type Page } from '@playwright/test';
import { mockAmplifySession } from './auth-session';
import { mockClientBoundaries, expectOnlyMockedCalls } from './mock-boundaries';

async function mockProtectedRequests(page: Page, profileStatus = 200) {
  const calls: Array<{ path: string; authorization?: string }> = [];
  await mockClientBoundaries(page);
  await page.route('http://localhost:3000/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push({ path, authorization: request.headers().authorization });
    const responses: Record<string, unknown> = {
      '/users/me': { id: 'test-user-id', email: 'test@anywear.local' },
      '/wardrobe': [],
      '/wardrobe/categories': { categories: [] },
      '/outfits': { outfits: [] },
      '/weather/top-cities': { locations: [] },
      '/weather/current': null,
    };
    if (!(path in responses)) return route.fallback();
    return route.fulfill({
      status: path === '/users/me' ? profileStatus : 200,
      contentType: 'application/json',
      body: JSON.stringify(path === '/users/me' && profileStatus !== 200 ? { error: 'PROFILE_UNAVAILABLE' } : responses[path]),
    });
  });
  return calls;
}

test.afterEach(({ page }) => expectOnlyMockedCalls(page));

test('a valid Amplify session refreshes a protected route without rendering login', async ({ page }) => {
  await mockAmplifySession(page);
  const calls = await mockProtectedRequests(page);
  await page.addInitScript(() => {
    const loginRenders: string[] = [];
    Object.assign(window, { loginRenders });
    new MutationObserver(() => {
      if ([...document.querySelectorAll('h3')].some(node => node.textContent === 'Sign in')) {
        loginRenders.push(location.pathname);
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/wardrobe');
  await expect(page.getByRole('heading', { name: 'Wardrobe', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Wardrobe', exact: true })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, 'loginRenders'))).toEqual([]);
  expect(calls.filter(call => call.path === '/users/me').length).toBeGreaterThanOrEqual(2);
  expect(calls.every(call => call.authorization?.startsWith('Bearer '))).toBe(true);
  await expect(page).toHaveURL(/\/wardrobe$/);
});

test('a stale UI flag cannot admit a protected route without an SDK session', async ({ page }) => {
  const calls = await mockProtectedRequests(page);
  await page.addInitScript(() => localStorage.setItem('isAuthenticated', 'true'));
  await page.goto('/wardrobe');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  expect(calls).toEqual([]);
});

test('direct login navigation preserves a valid SDK session and enters server validation', async ({ page }) => {
  await mockAmplifySession(page);
  const calls = await mockProtectedRequests(page);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(calls.some(call => call.path === '/users/me')).toBe(true);
});

test('an expired SDK session without refresh credentials does not admit protected routes', async ({ page }) => {
  await mockAmplifySession(page, -60);
  const calls = await mockProtectedRequests(page);
  await page.goto('/wardrobe');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect(calls).toEqual([]);
});

test('protected content waits for server profile verification after SDK startup', async ({ page }) => {
  await mockAmplifySession(page);
  await mockProtectedRequests(page);
  let releaseProfile!: () => void;
  const profileReady = new Promise<void>(resolve => { releaseProfile = resolve; });
  let observeProfile!: () => void;
  const profileRequested = new Promise<void>(resolve => { observeProfile = resolve; });
  await page.route('**/users/me', async (route) => {
    observeProfile();
    await profileReady;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'test-user-id' }) });
  });
  await page.goto('/wardrobe');
  await profileRequested;
  await expect(page.getByText('Setting up your wardrobe...', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wardrobe', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0);
  releaseProfile();
  await expect(page.getByRole('heading', { name: 'Wardrobe', exact: true })).toBeVisible();
});

test('server profile validation still gates protected content', async ({ page }) => {
  await mockAmplifySession(page);
  const calls = await mockProtectedRequests(page, 500);
  await page.goto('/wardrobe');
  await expect(page.getByRole('heading', { name: 'Profile Sync Failed' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wardrobe', exact: true })).toHaveCount(0);
  expect(calls.every(call => call.path === '/users/me')).toBe(true);
});
