import { test as base, expect, type Page } from '@playwright/test';

type MyFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<MyFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // 1. Set authentication state in localStorage before any navigation
    await page.addInitScript(() => {
      window.localStorage.setItem('isAuthenticated', 'true');
    });

    // 2. Global Mocks for common endpoints
    await page.route('**/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          email: 'test@anywear.local',
          locationId: null,
          locationName: null,
          createdAt: new Date().toISOString()
        })
      });
    });

    await use(page);
  },
});

export { expect };
