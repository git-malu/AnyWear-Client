import { test, expect } from './fixtures';

test.describe('Weather Integration', () => {
  
  test('should show empty state on dashboard when no location is configured', async ({ authenticatedPage: page }) => {
    // 1. Mock weather/current to return null (empty state)
    await page.route('**/weather/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'null'
      });
    });

    await page.goto('/dashboard');
    
    // 2. Verify empty state message and CTA
    await expect(page.getByText(/Set your location to see today's weather/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Set Location' })).toBeVisible();
  });

  test('should manually set location via city search', async ({ authenticatedPage: page }) => {
    let updatedLocationId = '';

    // 1. Mock endpoints
    await page.route('**/weather/current', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });

    await page.route('**/weather/city-lookup?q=shanghai*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          locations: [{ id: '101020100', name: 'Shanghai', adm1: 'Shanghai', country: 'China', lat: '31.23', lon: '121.47' }]
        })
      });
    });

    await page.route('**/users/profile', async (route) => {
      const body = route.request().postDataJSON();
      updatedLocationId = body.locationId;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    // 2. Go to settings and search
    await page.goto('/settings');
    await page.getByPlaceholder('Search for a city...').fill('shanghai');
    await page.getByRole('button', { name: 'Search' }).click();
    
    // 3. Wait for results and select
    const resultButton = page.locator('ul button').filter({ hasText: 'Shanghai' });
    await expect(resultButton).toBeVisible();
    await resultButton.click();

    // 4. Verify update
    expect(updatedLocationId).toBe('101020100');
  });

  test('should manually set location via Popular City chips', async ({ authenticatedPage: page }) => {
    let updatedLocationName = '';

    // 1. Mock top-cities and profile update
    await page.route('**/weather/top-cities', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          locations: [
            { id: '101010100', name: 'Beijing', adm1: 'Beijing', lat: '39.9', lon: '116.4' },
            { id: '101280101', name: 'Guangzhou', adm1: 'Guangdong', lat: '23.1', lon: '113.2' }
          ]
        })
      });
    });

    await page.route('**/users/profile', async (route) => {
      const body = route.request().postDataJSON();
      updatedLocationName = body.locationName;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    // 2. Go to settings and click a chip
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Beijing' }).click();

    // 3. Verify update
    expect(updatedLocationName).toBe('Beijing, Beijing');
  });

  test('should set location via auto-detect (geolocation)', async ({ authenticatedPage: page }) => {
    let updatedLat = 0;
    let updatedLon = 0;

    // 1. Grant geolocation permissions and mock coordinates
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 30.27, longitude: 120.15 });

    // 2. Mock profile update
    await page.route('**/users/profile', async (route) => {
      const body = route.request().postDataJSON();
      if (body.latitude && body.longitude) {
        updatedLat = body.latitude;
        updatedLon = body.longitude;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    // 3. Go to settings and click auto-detect
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Auto-Detect My Location' }).click();

    // 4. Verify update
    await expect(page.getByText('Location updated successfully')).toBeVisible();
    expect(updatedLat).toBeCloseTo(30.27);
    expect(updatedLon).toBeCloseTo(120.15);
  });

  test('should display weather data on dashboard when location is set', async ({ authenticatedPage: page }) => {
    // 1. Mock weather/current with data
    await page.route('**/weather/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          locationName: 'Hangzhou, Zhejiang',
          temperature: '22',
          feelsLike: '24',
          icon: '100',
          conditionText: 'Sunny',
          humidity: '45',
          windDir: 'North',
          windScale: '1',
          obsTime: new Date().toISOString(),
          clothingIndex: {
            suggestion: 'T-shirt and light trousers are fine.'
          }
        })
      });
    });

    // 2. Mock users/me to have a location
    await page.route('**/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          email: 'test@anywear.local',
          locationId: '101210101',
          locationName: 'Hangzhou, Zhejiang'
        })
      });
    });

    await page.goto('/dashboard');

    // 3. Verify widget content
    const widget = page.locator('div.bg-white.shadow.rounded-lg.p-6').first();
    await expect(widget.getByText('Hangzhou, Zhejiang')).toBeVisible();
    await expect(widget.getByText('22°C')).toBeVisible();
    await expect(widget.getByText('Sunny')).toBeVisible();
    await expect(widget.getByText(/T-shirt and light trousers/)).toBeVisible();
  });
});
