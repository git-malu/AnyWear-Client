import { test, expect, type Page } from '@playwright/test';

const ITEM_ID = '11111111-1111-1111-8111-111111111111';

const mockItem = {
  id: ITEM_ID,
  ownerId: 'test-user-id',
  name: 'My T-Shirt',
  imageKeys: [{ key: 'https://example.com/test.jpg', isPrimary: true }],
  category: 'Top',
  taggingStatus: 'processing',
  weatherTags: ['Warm', 'Temperate'],
  styleAttributes: {
    color: 'Black',
    material: 'Cotton',
    design: 'Short-sleeve T-shirt',
    fit: 'Regular',
    pattern: 'Solid',
    neckline: 'Crew Neck',
    vibe: 'Casual',
  },
  isPublic: false,
  imageEmbedding: null,
};

interface MockState {
  showItems: boolean;
  status: string;
}

async function setupMock(page: Page, state: MockState) {
  // Mock the S3 upload fetch (the presigned URL PUT)
  await page.route('**/s3.example.com/**', async (route) => {
    await route.fulfill({ status: 200 });
  });

  // Mock auth
  await page.route('**/users/me', async (route, request) => {
    if (new URL(request.url()).port !== '3000') { await route.continue(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-user-id', email: 'test@anywear.local',
        locationId: null, locationName: null, createdAt: new Date().toISOString(),
      }),
    });
  });

  // Mock weather
  await page.route('**/weather/**', async (route, request) => {
    if (new URL(request.url()).port !== '3000') { await route.continue(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });

  // WardrobePage also loads the outfit summary. Keep this test focused on
  // auto-tagging instead of letting the unmocked request trigger the global
  // 401 auth redirect.
  await page.route('**/outfits', async (route, request) => {
    if (new URL(request.url()).port !== '3000') { await route.continue(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ outfits: [] }),
    });
  });

  // Mock all wardrobe API calls
  await page.route('**/wardrobe**', async (route, request) => {
    const url = new URL(request.url());
    if (url.port !== '3000') { await route.continue(); return; }

    const path = url.pathname;
    const method = request.method();

    if (method === 'POST' && path.endsWith('/upload-url')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://s3.example.com/upload', key: 'wardrobe/test.png', itemId: ITEM_ID }),
      });
    }
    if (method === 'POST' && path.endsWith('/upload')) {
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ itemId: ITEM_ID, taggingStatus: 'processing' }),
      });
    }
    if (method === 'POST' && path.endsWith('/retag')) {
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ itemId: ITEM_ID, taggingStatus: 'processing' }),
      });
    }
    if (method === 'PATCH') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockItem) });
    }
    if (method === 'DELETE') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }
    if (method === 'GET' && path.endsWith('/categories')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ categories: ['Top', 'Bottom', 'Outerwear'] }),
      });
    }
    if (method === 'GET') {
      if (state.showItems) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ ...mockItem, taggingStatus: state.status }]),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }

    await route.continue();
  });
}

test.describe('Wardrobe Auto-Tagging', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('isAuthenticated', 'true');
    });
  });

  test('should show processing badge after upload and transition to ready', async ({ page }) => {
    const state: MockState = { showItems: false, status: 'processing' };
    await setupMock(page, state);

    await page.goto('/wardrobe');
    await expect(page.getByRole('heading', { name: 'Wardrobe' })).toBeVisible();
    await expect(page.getByText('Your wardrobe is empty.')).toBeVisible();

    // Add item — upload flow
    await page.getByRole('button', { name: 'Add Item' }).click();
    await expect(page.getByRole('heading', { name: 'Add Wardrobe Item' })).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('browser/fixtures/dummy.png');

    // Switch to returning items BEFORE clicking upload
    state.showItems = true;
    state.status = 'processing';

    await page.getByRole('button', { name: 'Upload & Auto-Tag' }).click();

    // Item should appear with Analyzing badge
    await expect(page.getByText('My T-Shirt')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Analyzing...')).toBeVisible({ timeout: 5000 });

    // Switch to ready
    state.status = 'ready';
    await page.reload();
    await expect(page.getByText('My T-Shirt')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Analyzing...')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Black • Cotton')).toBeVisible({ timeout: 5000 });
  });

  test('should show item details with auto-tagged attributes', async ({ page }) => {
    const state: MockState = { showItems: true, status: 'ready' };
    await setupMock(page, state);

    await page.goto('/wardrobe');
    await expect(page.getByText('My T-Shirt')).toBeVisible({ timeout: 5000 });

    await page.getByText('My T-Shirt').click();
    await expect(page.getByRole('heading', { name: 'Item Details' })).toBeVisible({ timeout: 3000 });

    // Verify auto-tagged fields are populated
    await expect(page.locator('input[placeholder="e.g. My favorite hoodie"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. Top"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. Black, White"]')).toBeVisible();

    // Edit and save
    await page.locator('input[placeholder="e.g. My favorite hoodie"]').fill('My Favorite Hoodie');
    await page.getByRole('button', { name: 'Save Changes' }).click();
  });

  test('should allow re-tagging from item details', async ({ page }) => {
    const state: MockState = { showItems: true, status: 'ready' };
    await setupMock(page, state);

    await page.goto('/wardrobe');
    await page.getByText('My T-Shirt').click();
    await expect(page.getByRole('heading', { name: 'Item Details' })).toBeVisible({ timeout: 3000 });

    const retagButton = page.getByRole('button', { name: 'Re-tag' });
    await expect(retagButton).toBeVisible();
    await expect(retagButton).toBeEnabled();

    page.on('dialog', (dialog) => dialog.accept());
    await retagButton.click();
  });

  test('should filter items by category chip', async ({ page }) => {
    const state: MockState = { showItems: true, status: 'ready' };
    await setupMock(page, state);

    await page.goto('/wardrobe');
    await expect(page.getByText('My T-Shirt')).toBeVisible({ timeout: 5000 });

    const allButton = page.getByRole('button', { name: 'All' });
    const topButton = page.getByRole('button', { name: 'Top' });

    await expect(allButton).toBeVisible();
    await expect(topButton).toBeVisible();
    await expect(allButton).toHaveClass(/bg-indigo-600/);

    await topButton.click();
    await expect(topButton).toHaveClass(/bg-indigo-600/);
    await expect(allButton).not.toHaveClass(/bg-indigo-600/);
  });

  test('should show "Failed" badge for failed items', async ({ page }) => {
    const state: MockState = { showItems: true, status: 'failed' };
    await setupMock(page, state);
    // Override name
    const failItem = { ...mockItem, name: 'Bad Upload', styleAttributes: {} };

    // Re-route with failed item
    await page.unroute('**/wardrobe**');
    await page.route('**/s3.example.com/**', async (route) => { await route.fulfill({ status: 200 }); });
    await page.route('**/users/me', async (route, request) => {
      if (new URL(request.url()).port !== '3000') { await route.continue(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'test-user-id', email: 'test@anywear.local', locationId: null, locationName: null, createdAt: new Date().toISOString() }) });
    });
    await page.route('**/weather/**', async (route, request) => {
      if (new URL(request.url()).port !== '3000') { await route.continue(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });
    await page.route('**/wardrobe**', async (route, request) => {
      const url = new URL(request.url());
      if (url.port !== '3000') { await route.continue(); return; }
      const method = request.method();
      if (method === 'GET' && url.pathname.endsWith('/categories')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ categories: ['Top'] }) });
      }
      if (method === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ ...failItem, taggingStatus: 'failed' }]) });
      }
      await route.continue();
    });

    await page.goto('/wardrobe');
    await expect(page.getByText('Bad Upload')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Failed')).toBeVisible({ timeout: 5000 });
  });
});
