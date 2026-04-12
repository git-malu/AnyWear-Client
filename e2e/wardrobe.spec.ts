import { test, expect } from '@playwright/test';
import {
  CognitoIdentityProviderClient,
  AdminConfirmSignUpCommand,
  AdminDeleteUserCommand
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const USER_POOL_ID = process.env.USER_POOL_ID;

test.describe('Wardrobe Management', () => {
  let testEmail: string;

  test.beforeEach(async ({ page }) => {
    testEmail = `test+wardrobe_${Date.now()}@anywear.local`;

    if (!USER_POOL_ID) {
      test.skip(true, 'USER_POOL_ID is not set. Skipping the test.');
      return;
    }

    // 1. Register User
    await page.goto('/register');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await page.waitForURL(/\/verify|\/login/);

    // 2. Confirm User via AWS SDK
    await cognitoClient.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: USER_POOL_ID,
        Username: testEmail,
      })
    );

    // 3. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // 4. Wait for dashboard
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

  test('should add, view, update and delete a wardrobe item', async ({ page }) => {
    // Navigate to Wardrobe page
    await page.goto('/wardrobe');
    await expect(page.getByRole('heading', { name: 'Wardrobe' })).toBeVisible();

    // 1. Add new item
    await page.getByRole('button', { name: 'Add Item' }).click();
    
    // Expect modal to open
    await expect(page.getByRole('heading', { name: 'Add Wardrobe Item' })).toBeVisible();

    // Upload dummy file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/dummy.png');

    // Fill metadata
    await page.fill('input[placeholder="e.g. Tops, Pants, Shoes"]', 'T-Shirt');
    await page.fill('input[placeholder="e.g. Black, Blue"]', 'Blue');
    await page.fill('input[placeholder="e.g. Cotton, Denim"]', 'Cotton');

    // Save
    await page.getByRole('button', { name: 'Save Item' }).click();

    // Verify it appears in the grid
    // After save, the modal closes and grid should have "T-Shirt"
    await expect(page.locator('text=T-Shirt').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=blue • cotton').first()).toBeVisible({ timeout: 5000, ignoreCase: true });

    // 2. Edit the item
    await page.locator('text=T-Shirt').first().click();

    // Expect details modal to open
    await expect(page.getByRole('heading', { name: 'Edit Wardrobe Item' })).toBeVisible();

    // Change category and color
    const categoryInput = page.locator('div').filter({ hasText: /^Category$/ }).locator('input');
    await categoryInput.fill('Jacket');
    const colorInput = page.locator('div').filter({ hasText: /^Color$/ }).locator('input');
    await colorInput.fill('Red');

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Verify changes in the grid
    await expect(page.locator('text=Jacket').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=red • cotton').first()).toBeVisible({ timeout: 5000, ignoreCase: true });

    // 3. Delete the item
    // Setup dialog handler to accept the confirm dialog
    page.on('dialog', dialog => dialog.accept());

    // Click the item to open details again
    await page.locator('text=Jacket').first().click();
    
    // Click delete
    await page.getByRole('button', { name: 'Delete Item' }).click();

    // Verify it's gone
    // Should show "Your wardrobe is empty." if it was the only item
    await expect(page.locator('text=Your wardrobe is empty.')).toBeVisible({ timeout: 10000 });
  });
});
