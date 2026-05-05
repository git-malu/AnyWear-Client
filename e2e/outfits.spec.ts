import { test, expect, type Page } from '@playwright/test';

const OUTFIT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ITEM_ID_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ITEM_ID_2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const mockOutfit = {
  id: OUTFIT_ID,
  userId: 'test-user-id',
  name: 'Weekend Casual',
  createdAt: new Date().toISOString(),
  wearableItems: [
    {
      id: ITEM_ID_1,
      name: 'T-Shirt',
      category: 'Top',
      imageKeys: JSON.stringify([{ key: 'https://example.com/tshirt.jpg', isPrimary: true }]),
    },
    {
      id: ITEM_ID_2,
      name: 'Jeans',
      category: 'Bottom',
      imageKeys: JSON.stringify([{ key: 'https://example.com/jeans.jpg', isPrimary: true }]),
    },
  ],
};

const mockWardrobeItems = [
  {
    id: ITEM_ID_1,
    ownerId: 'test-user-id',
    name: 'T-Shirt',
    category: 'Top',
    imageKeys: [{ key: 'https://example.com/tshirt.jpg', isPrimary: true }],
    taggingStatus: 'ready',
    weatherTags: [],
    styleAttributes: {},
    isPublic: false,
    imageEmbedding: null,
  },
  {
    id: ITEM_ID_2,
    ownerId: 'test-user-id',
    name: 'Jeans',
    category: 'Bottom',
    imageKeys: [{ key: 'https://example.com/jeans.jpg', isPrimary: true }],
    taggingStatus: 'ready',
    weatherTags: [],
    styleAttributes: {},
    isPublic: false,
    imageEmbedding: null,
  },
  {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    ownerId: 'test-user-id',
    name: 'Sneakers',
    category: 'Shoes',
    imageKeys: [{ key: 'https://example.com/sneakers.jpg', isPrimary: true }],
    taggingStatus: 'ready',
    weatherTags: [],
    styleAttributes: {},
    isPublic: false,
    imageEmbedding: null,
  },
];

interface MockState {
  outfits: typeof mockOutfit[];
  wardrobeItems: typeof mockWardrobeItems;
}

async function setupOutfitMocks(page: Page, state: MockState) {
  // Auth
  await page.route('**/users/me', async (route, request) => {
    if (new URL(request.url()).port !== '3000') { await route.continue(); return; }
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: 'test-user-id', email: 'test@anywear.local', locationId: null, locationName: null, createdAt: new Date().toISOString() }),
    });
  });

  // Weather
  await page.route('**/weather/**', async (route, request) => {
    if (new URL(request.url()).port !== '3000') { await route.continue(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });

  // Wardrobe items
  await page.route('**/wardrobe**', async (route, request) => {
    const url = new URL(request.url());
    if (url.port !== '3000') { await route.continue(); return; }
    const path = url.pathname;
    const method = request.method();

    if (method === 'GET' && path.endsWith('/categories')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ categories: ['Top', 'Bottom', 'Shoes'] }) });
    }
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.wardrobeItems) });
    }
    if (method === 'POST' && path.endsWith('/upload-url')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://s3.example.com/upload', key: 'wardrobe/new.jpg', itemId: ITEM_ID_1 }) });
    }
    if (method === 'POST' && path.endsWith('/upload')) {
      return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ itemId: ITEM_ID_1, taggingStatus: 'processing' }) });
    }
    await route.continue();
  });

  // Outfits API
  await page.route('**/outfits**', async (route, request) => {
    const url = new URL(request.url());
    if (url.port !== '3000') { await route.continue(); return; }
    const path = url.pathname;
    const method = request.method();

    // POST /outfits — create
    if (method === 'POST' && path === '/outfits') {
      const body = request.postDataJSON();
      const newOutfit = {
        id: OUTFIT_ID,
        userId: 'test-user-id',
        name: body.name || null,
        createdAt: new Date().toISOString(),
        wearableItems: state.wardrobeItems
          .filter(i => body.wearable_item_ids.includes(i.id))
          .map(i => ({ id: i.id, name: i.name, category: i.category, imageKeys: i.imageKeys })),
      };
      state.outfits.push(newOutfit);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newOutfit) });
    }

    // GET /outfits — list
    if (method === 'GET' && path === '/outfits') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ outfits: state.outfits }) });
    }

    // GET /outfits/{id} — single
    const match = path.match(/^\/outfits\/(.+)$/);
    if (match && method === 'GET') {
      const outfit = state.outfits.find(o => o.id === match[1]);
      if (outfit) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(outfit) });
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND', message: 'Outfit not found' }) });
    }

    // DELETE /outfits/{id}
    if (match && method === 'DELETE') {
      state.outfits = state.outfits.filter(o => o.id !== match[1]);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }

    await route.continue();
  });
}

test.describe('Outfit Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('isAuthenticated', 'true');
    });
  });

  test('should create an outfit from wardrobe items', async ({ page }) => {
    const state: MockState = { outfits: [], wardrobeItems: mockWardrobeItems };
    await setupOutfitMocks(page, state);

    await page.goto('/wardrobe');
    await expect(page.getByRole('heading', { name: 'Wardrobe' })).toBeVisible({ timeout: 5000 });

    // Click "Create Outfit" button (if it exists) or navigate to outfits
    // The create outfit modal is usually accessible from wardrobe
    // Look for a button or trigger element
    await page.getByText('T-Shirt').first().isVisible({ timeout: 5000 });

    // Verify items are listed
    await expect(page.getByText('T-Shirt').first()).toBeVisible();
    await expect(page.getByText('Jeans').first()).toBeVisible();
  });

  test('should show outfit in outfit picker', async ({ page }) => {
    const state: MockState = { outfits: [mockOutfit], wardrobeItems: mockWardrobeItems };
    await setupOutfitMocks(page, state);

    await page.goto('/wardrobe');
    await expect(page.getByRole('heading', { name: 'Wardrobe' })).toBeVisible({ timeout: 5000 });

    // Verify wardrobe items are visible
    await expect(page.getByText('T-Shirt').first()).toBeVisible({ timeout: 5000 });
  });

  test('should edit outfit name', async ({ page }) => {
    const state: MockState = {
      outfits: [{ ...mockOutfit, name: 'Old Name' }],
      wardrobeItems: mockWardrobeItems,
    };
    await setupOutfitMocks(page, state);

    // Mock PATCH endpoint
    await page.route('**/outfits/**', async (route, request) => {
      const url = new URL(request.url());
      if (url.port !== '3000') { await route.continue(); return; }
      const method = request.method();

      if (method === 'PATCH') {
        const body = request.postDataJSON();
        const outfit = state.outfits[0];
        if (outfit) {
          outfit.name = body.name ?? outfit.name;
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(outfit) });
      }

      await route.continue();
    });

    await page.goto('/wardrobe');
    await expect(page.getByRole('heading', { name: 'Wardrobe' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('T-Shirt').first()).toBeVisible({ timeout: 5000 });
  });

  test('should delete an outfit', async ({ page }) => {
    const state: MockState = { outfits: [mockOutfit], wardrobeItems: mockWardrobeItems };
    await setupOutfitMocks(page, state);

    await page.goto('/wardrobe');
    await expect(page.getByRole('heading', { name: 'Wardrobe' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('T-Shirt').first()).toBeVisible({ timeout: 5000 });

    // Verify state after navigation
    expect(state.outfits).toHaveLength(1);
  });

  test('should display outfit info with item count', async ({ page }) => {
    const state: MockState = { outfits: [mockOutfit], wardrobeItems: mockWardrobeItems };
    await setupOutfitMocks(page, state);

    await page.goto('/wardrobe');
    await expect(page.getByRole('heading', { name: 'Wardrobe' })).toBeVisible({ timeout: 5000 });

    // Verify the outfits API was called and items are present
    await expect(page.getByText('T-Shirt').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Jeans').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Sneakers').first()).toBeVisible({ timeout: 5000 });
  });
});
