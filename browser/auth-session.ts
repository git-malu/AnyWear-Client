import type { Page } from '@playwright/test';

export const MOCK_USER_POOL_ID = 'us-east-1_mockpool';
export const MOCK_USER_POOL_CLIENT_ID = 'mock-client-id';

/** Seed the SDK's session input with unsigned fixture tokens; all Service/cloud calls stay mocked. */
export async function mockAmplifySession(page: Page, expiresIn = 86_400) {
  await page.addInitScript(({ clientId, expiresIn }) => {
    const username = 'test-user';
    const encode = (payload: Record<string, unknown>) => btoa(JSON.stringify(payload))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const token = (tokenUse: string) => `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: 'test-user-id', 'cognito:username': username, token_use: tokenUse,
      exp: Math.floor(Date.now() / 1000) + expiresIn,
      iat: Math.floor(Date.now() / 1000),
    })}.fixture`;
    const prefix = `CognitoIdentityServiceProvider.${clientId}`;
    if (localStorage.getItem(`${prefix}.LastAuthUser`)) return;
    localStorage.setItem(`${prefix}.LastAuthUser`, username);
    localStorage.setItem(`${prefix}.${username}.accessToken`, token('access'));
    localStorage.setItem(`${prefix}.${username}.idToken`, token('id'));
    localStorage.setItem(`${prefix}.${username}.clockDrift`, '0');
  }, { clientId: MOCK_USER_POOL_CLIENT_ID, expiresIn });
}
