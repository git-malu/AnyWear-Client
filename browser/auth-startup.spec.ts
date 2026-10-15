import { test, expect, type Page } from '@playwright/test';
import { mockAmplifySession, MOCK_USER_POOL_CLIENT_ID } from './auth-session';
import { mockClientBoundaries, expectOnlyMockedCalls } from './mock-boundaries';

const PERSISTED_REFRESH_TOKEN_KEY =
  `CognitoIdentityServiceProvider.${MOCK_USER_POOL_CLIENT_ID}.test-user.refreshToken`;

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

test('logout publishes the signed-out UI only after the SDK sign-out destroyed the session', async ({ page, context }) => {
  await mockAmplifySession(page);
  const calls = await mockProtectedRequests(page);
  await page.goto('/wardrobe');
  await expect(page.getByRole('heading', { name: 'Wardrobe', exact: true })).toBeVisible();
  const profileRequestsBeforeLogout = calls.filter(call => call.path === '/users/me').length;

  // Give the fixture session a revocable access token and a refresh token so the SDK's sign-out
  // performs its revoke request, which this test holds open to observe the in-flight UI state.
  await page.evaluate(({ clientId, username }) => {
    const encode = (payload: Record<string, unknown>) => btoa(JSON.stringify(payload))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const issued = Math.floor(Date.now() / 1000);
    const accessToken = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: 'test-user-id', 'cognito:username': username, token_use: 'access',
      origin_jti: 'fixture-session', exp: issued + 3600, iat: issued,
    })}.fixture`;
    const prefix = `CognitoIdentityServiceProvider.${clientId}.${username}`;
    localStorage.setItem(`${prefix}.accessToken`, accessToken);
    localStorage.setItem(`${prefix}.refreshToken`, 'fixture-refresh-token');
  }, { clientId: MOCK_USER_POOL_CLIENT_ID, username: 'test-user' });

  let releaseRevoke!: () => void;
  const revokeReleased = new Promise<void>((resolve) => { releaseRevoke = resolve; });
  let observeRevoke!: () => void;
  const revokeRequested = new Promise<void>((resolve) => { observeRevoke = resolve; });
  const corsHeaders = {
    'access-control-allow-origin': 'http://localhost:1420',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': '*',
  };
  await page.route('https://cognito-idp.*.amazonaws.com/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }
    observeRevoke();
    await revokeReleased;
    return route.fulfill({
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/x-amz-json-1.1' },
      body: '{}',
    });
  });

  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await revokeRequested;

  // `RevokeToken` is still in flight, so the SDK has not destroyed the persisted session and the
  // session is still restorable. Polling the pending control first keeps the absence assertion
  // below non-vacuous: the protected layout must still be on screen.
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Wardrobe', exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), PERSISTED_REFRESH_TOKEN_KEY))
    .toBe('fixture-refresh-token');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0);

  releaseRevoke();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  const persistedKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter(key => key.startsWith('CognitoIdentityServiceProvider.')));
  expect(persistedKeys).toEqual([]);

  // A document the fixture does not re-seed cannot restore the session, and a reload of that same
  // document stays unauthenticated without asking the Service for a profile. The reload is asserted
  // here rather than on the page above because `mockAmplifySession` re-seeds synthetic tokens into
  // every document that has none, which makes a reload in a fixture-seeded page non-probative.
  const laterDocument = await context.newPage();
  const laterRequests: string[] = [];
  await mockClientBoundaries(laterDocument);
  await laterDocument.route('http://localhost:3000/**', (route) => {
    laterRequests.push(new URL(route.request().url()).pathname);
    return route.fallback();
  });
  try {
    await laterDocument.goto('/wardrobe');
    await expect(laterDocument).toHaveURL(/\/login$/);
    await expect(laterDocument.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await laterDocument.reload();
    await expect(laterDocument.getByRole('heading', { name: 'Today', exact: true })).toHaveCount(0);
    await expect(laterDocument).toHaveURL(/\/login$/);
    await expect(laterDocument.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(laterRequests.filter(path => path === '/users/me')).toEqual([]);
    expectOnlyMockedCalls(laterDocument);
  } finally {
    await laterDocument.close();
  }
  expect(calls.filter(call => call.path === '/users/me')).toHaveLength(profileRequestsBeforeLogout);
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
