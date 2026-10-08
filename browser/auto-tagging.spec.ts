import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { GetWardrobe200Item } from '../src/api/model/getWardrobe200Item';
import { mockClientBoundaries, expectOnlyMockedCalls } from './mock-boundaries';

const ITEM_ID = '11111111-1111-1111-8111-111111111111';
const mockItem: GetWardrobe200Item = {
  id: ITEM_ID, ownerId: 'test-user-id', name: 'My T-Shirt',
  imageKeys: [{ key: 'https://example.com/test.jpg', isPrimary: true }],
  category: 'Top', taggingStatus: 'ready', weatherTags: ['Warm', 'Temperate'],
  styleAttributes: { color: 'Black', material: 'Cotton', design: 'Short-sleeve T-shirt', fit: 'Regular', pattern: 'Solid', neckline: 'Crew Neck', vibe: 'Casual' },
  isPublic: false, imageEmbedding: null,
  taggingStateVersion: 1, taggingErrorCode: null, taggingErrorMessage: null,
  createdAt: '2026-05-05T00:00:00.000Z', updatedAt: '2026-05-05T00:00:00.000Z',
};

interface MockState {
  items: GetWardrobe200Item[];
  mutations: Array<{ method: string; path: string; body: unknown }>;
  categories: Array<string | null>;
  uploadedImage?: Buffer;
}

function stateWithItem(item = structuredClone(mockItem)): MockState {
  return { items: [item], mutations: [], categories: [] };
}

async function setupMock(page: Page, state: MockState) {
  await mockClientBoundaries(page);
  await page.route('https://s3.example.com/upload', async (route, request) => {
    state.uploadedImage = request.postDataBuffer() ?? undefined;
    state.mutations.push({ method: request.method(), path: '/upload', body: { contentType: request.headers()['content-type'] } });
    return route.fulfill({ status: 200 });
  });
  await page.route('http://localhost:3000/**', async (route, request) => {
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'GET' && path === '/users/me') return json({ id: 'test-user-id', email: 'test@anywear.local' });
    if (method === 'GET' && path === '/outfits') return json({ outfits: [] });
    if (method === 'GET' && path === '/wardrobe/categories') return json({ categories: ['Top', 'Bottom'] });
    if (method === 'GET' && path === '/wardrobe') {
      const category = url.searchParams.get('category');
      state.categories.push(category);
      return json(state.items.filter(item => !category || item.category === category));
    }
    if (method === 'POST' && path === '/wardrobe/upload-url') {
      state.mutations.push({ method, path, body: request.postDataJSON() });
      return json({ url: 'https://s3.example.com/upload', key: 'wardrobe/test.png', itemId: ITEM_ID });
    }
    if (method === 'POST' && path === '/wardrobe/upload') {
      state.mutations.push({ method, path, body: request.postDataJSON() });
      state.items = [{ ...structuredClone(mockItem), taggingStatus: 'processing' }];
      return json({ itemId: ITEM_ID, taggingStatus: 'processing' }, 202);
    }
    if (method === 'PATCH' && path === `/wardrobe/items/${ITEM_ID}`) {
      const body = request.postDataJSON();
      state.mutations.push({ method, path, body });
      const item = state.items.find(item => item.id === ITEM_ID);
      if (!item) return json({ error: 'NOT_FOUND' }, 404);
      Object.assign(item, body);
      return json(item);
    }
    if (method === 'POST' && path === `/wardrobe/items/${ITEM_ID}/retag`) {
      state.mutations.push({ method, path, body: request.postData() ? request.postDataJSON() : undefined });
      state.items = state.items.map(item => ({ ...item, taggingStatus: 'processing' }));
      return json({ itemId: ITEM_ID, taggingStatus: 'processing' }, 202);
    }
    if (method === 'GET' && path === `/wardrobe/items/${ITEM_ID}/stream`) {
      return route.fulfill({ contentType: 'text/event-stream', body: '' });
    }
    return route.fallback();
  });
}

test.describe('Wardrobe Auto-Tagging (mocked Client integration)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('isAuthenticated', 'true'));
  });
  test.afterEach(({ page }) => expectOnlyMockedCalls(page));

  test('uploads an image, shows processing and polls the ready item without reload', async ({ page }) => {
    const state: MockState = { items: [], mutations: [], categories: [] };
    await setupMock(page, state);
    await page.clock.install();
    await page.goto('/wardrobe');
    await expect(page.getByText('Your wardrobe is empty.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Add Item', exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles('browser/fixtures/dummy.png');
    await page.getByRole('button', { name: 'Upload & Auto-Tag', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Add Wardrobe Item' })).not.toBeVisible();
    await expect(page.getByText('My T-Shirt', { exact: true })).toBeVisible();
    await expect(page.getByText('Analyzing...', { exact: true })).toBeVisible();
    expect(state.mutations).toEqual([
      { method: 'POST', path: '/wardrobe/upload-url', body: { contentType: 'image/png', extension: 'png' } },
      { method: 'PUT', path: '/upload', body: { contentType: 'image/png' } },
      { method: 'POST', path: '/wardrobe/upload', body: { itemId: ITEM_ID } },
    ]);
    expect(state.uploadedImage).toEqual(await readFile('browser/fixtures/dummy.png'));
    state.items[0] = { ...structuredClone(mockItem), taggingStatus: 'ready' };
    await page.clock.fastForward(10_000);
    await expect(page.getByText('Analyzing...', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Black • Cotton', { exact: true })).toBeVisible();
  });

  test('populates auto-tagged values, saves edits and refreshes the item', async ({ page }) => {
    const state = stateWithItem();
    await setupMock(page, state);
    await page.goto('/wardrobe');
    await page.getByText('My T-Shirt', { exact: true }).click();
    await expect(page.getByPlaceholder('e.g. My favorite hoodie')).toHaveValue('My T-Shirt');
    await expect(page.getByPlaceholder('e.g. Top', { exact: true })).toHaveValue('Top');
    await expect(page.getByPlaceholder('e.g. Black, White')).toHaveValue('Black');
    await expect(page.getByPlaceholder('e.g. Cotton', { exact: true })).toHaveValue('Cotton');
    await expect(page.getByPlaceholder('e.g. Cold, Windy, Warm')).toHaveValue('Warm, Temperate');
    await page.getByPlaceholder('e.g. My favorite hoodie').fill('My Favorite Hoodie');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Item Details' })).not.toBeVisible();
    await expect(page.getByText('My Favorite Hoodie', { exact: true })).toBeVisible();
    expect(state.mutations).toEqual([{ method: 'PATCH', path: `/wardrobe/items/${ITEM_ID}`, body: {
      name: 'My Favorite Hoodie', category: 'Top', imageKeys: mockItem.imageKeys,
      styleAttributes: mockItem.styleAttributes, weatherTags: ['Warm', 'Temperate'],
    } }]);
  });

  test('requests re-tagging and refreshes the processing badge', async ({ page }) => {
    const state = stateWithItem();
    await setupMock(page, state);
    await page.goto('/wardrobe');
    await page.getByText('My T-Shirt', { exact: true }).click();
    const retagButton = page.getByRole('button', { name: 'Re-tag', exact: true });
    await expect(retagButton).toBeEnabled();
    const messages: string[] = [];
    page.on('dialog', async dialog => { messages.push(dialog.message()); await dialog.accept(); });
    await retagButton.click();
    await expect(page.getByRole('heading', { name: 'Item Details' })).not.toBeVisible();
    await expect(page.getByText('Analyzing...', { exact: true })).toBeVisible();
    expect(messages).toEqual(['Re-tagging started. Check back shortly.']);
    expect(state.mutations).toEqual([{ method: 'POST', path: `/wardrobe/items/${ITEM_ID}/retag`, body: undefined }]);
  });

  test('filters by the category query and restores all items', async ({ page }) => {
    const state = stateWithItem();
    state.items.push({ ...structuredClone(mockItem), id: '22222222-2222-4222-8222-222222222222', name: 'My Jeans', category: 'Bottom' });
    await setupMock(page, state);
    await page.goto('/wardrobe');
    await expect(page.getByText('My T-Shirt', { exact: true })).toBeVisible();
    await expect(page.getByText('My Jeans', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Top', exact: true }).click();
    await expect(page.getByText('My T-Shirt', { exact: true })).toBeVisible();
    await expect(page.getByText('My Jeans', { exact: true })).not.toBeVisible();
    expect(state.categories).toContain('Top');
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.getByText('My Jeans', { exact: true })).toBeVisible();
  });

  test('shows the failed badge and opens failed item details', async ({ page }) => {
    const state = stateWithItem({ ...structuredClone(mockItem), name: 'Bad Upload', taggingStatus: 'failed', styleAttributes: {} });
    await setupMock(page, state);
    await page.goto('/wardrobe');
    await expect(page.getByText('Failed', { exact: true })).toBeVisible();
    await page.getByText('Bad Upload', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Item Details' })).toBeVisible();
    await expect(page.getByText('Tagging Failed', { exact: true })).toBeVisible();
  });
});
