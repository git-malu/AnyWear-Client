import { test, expect } from '@playwright/test';
import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const USER_POOL_ID = process.env.USER_POOL_ID;

test.describe('Weather Integration', () => {
  let testEmail: string;

  test.beforeEach(async ({ page }) => {
    testEmail = `test+weather_${Date.now()}@anywear.local`;

    if (!USER_POOL_ID) {
      test.skip(true, 'USER_POOL_ID is not set. Skipping the test.');
      return;
    }

    // 1. Register User
    await page.goto('/register');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await page.waitForURL('/login');

    // 2. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // 3. Wait for dashboard
    await page.waitForURL('/dashboard');
  });

  test.afterEach(async () => {
    if (USER_POOL_ID) {
      try {
        await cognitoClient.send(
          new AdminDeleteUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: testEmail,
          })
        );
      } catch (error: any) {
        if (error.name !== 'UserNotFoundException') {
          console.error(`Failed to delete user ${testEmail}:`, error);
        }
      }
    }
  });

  test('should search for a city, select it, and see weather on dashboard', async ({ page }) => {
    // 1. Mock the backend calls for city lookup and weather
    await page.route('**/weather/city-lookup?q=hangzhou*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          locations: [
            {
              id: '101210101',
              name: 'Hangzhou',
              adm1: 'Zhejiang',
              adm2: 'Hangzhou',
              country: 'China',
              lat: '30.24603',
              lon: '120.21079'
            }
          ]
        })
      });
    });

    await page.route('**/weather/current', async (route) => {
      // Check if it's a GET request (fetching weather)
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            locationName: 'Hangzhou, Zhejiang',
            temperature: '25',
            feelsLike: '27',
            icon: '101',
            conditionText: 'Cloudy',
            humidity: '60',
            windDir: 'East',
            windScale: '2',
            obsTime: new Date().toISOString(),
            stale: false,
            clothingIndex: {
              suggestion: 'Light cotton clothes are recommended.'
            }
          })
        });
      } else {
        await route.continue();
      }
    });

    // 2. Go to settings to set location
    await page.goto('/settings');
    await expect(page.getByText('Set your location to see today\'s weather')).toBeVisible();

    // 3. Search for "hangzhou"
    const searchInput = page.getByPlaceholder('Search for a city...');
    await searchInput.fill('hangzhou');
    
    // Wait for and click the result
    await page.click('text=Hangzhou, Zhejiang');

    // Verify success message or change in UI
    await expect(page.getByText('Location updated successfully')).toBeVisible();

    // 4. Go back to dashboard and verify weather widget
    await page.goto('/dashboard');
    
    const weatherWidget = page.locator('div.bg-white.shadow.rounded-lg.p-6').first();
    await expect(weatherWidget.getByText('Hangzhou, Zhejiang')).toBeVisible();
    await expect(weatherWidget.getByText('25°C')).toBeVisible();
    await expect(weatherWidget.getByText('Cloudy')).toBeVisible();
    await expect(weatherWidget.getByText('Light cotton clothes are recommended.')).toBeVisible();
  });
});
