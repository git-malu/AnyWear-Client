import { test as base, expect, type Page } from '@playwright/test';
import { mockClientBoundaries, expectOnlyMockedCalls } from './mock-boundaries';
import { mockAmplifySession } from './auth-session';

type MyFixtures = {
  authenticatedPage: Page;
  mockGeolocation: (coords: { latitude: number; longitude: number }) => Promise<void>;
};

export const test = base.extend<MyFixtures>({
  // 1. Authenticated Page Fixture
  authenticatedPage: async ({ page }, use) => {
    await mockClientBoundaries(page);
    await mockAmplifySession(page);

    // Global Mocks for common endpoints
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

    await page.route('**/weather/top-cities', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ locations: [] })
      });
    });

    await page.route('**/weather/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'null'
      });
    });

    try {
      await use(page);
    } finally {
      expectOnlyMockedCalls(page);
    }
  },

  // 2. Geolocation Mocking Helper
  mockGeolocation: async ({ page }, use) => {
    const helper = async (coords: { latitude: number; longitude: number }) => {
      await page.addInitScript((pos) => {
        const mockGeolocation = {
          getCurrentPosition: (success: any) => {
            success({
              coords: {
                latitude: pos.latitude,
                longitude: pos.longitude,
                accuracy: 100,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
              timestamp: Date.now(),
            });
          },
          watchPosition: (success: any) => {
            success({
              coords: {
                latitude: pos.latitude,
                longitude: pos.longitude,
                accuracy: 100,
              },
              timestamp: Date.now(),
            });
            return 0;
          },
          clearWatch: () => {},
        };
        // @ts-ignore
        navigator.geolocation.getCurrentPosition = mockGeolocation.getCurrentPosition;
        // @ts-ignore
        navigator.geolocation.watchPosition = mockGeolocation.watchPosition;
      }, coords);
    };
    await use(helper);
  },
});

export { expect };
