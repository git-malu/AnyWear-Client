import { test, expect } from '@playwright/test';
import {
  CognitoIdentityProviderClient,
  AdminConfirmSignUpCommand,
  AdminDeleteUserCommand
} from '@aws-sdk/client-cognito-identity-provider';

// Create Cognito client. Credentials will be automatically picked up
// from standard AWS environment variables if present.
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

// For local testing, ensure these are set in your environment
// export USER_POOL_ID=us-east-1_xxxxx
const USER_POOL_ID = process.env.USER_POOL_ID;

test.describe('Authentication Flow with AWS SDK Bypass', () => {
  let testEmail: string;

  test.beforeEach(() => {
    // Generate a unique email for each test to avoid conflicts
    testEmail = `test+e2e_${Date.now()}@anywear.local`;
  });

  test.afterEach(async () => {
    // Teardown: Delete the user from Cognito to keep the pool clean
    if (USER_POOL_ID) {
      console.log(`Cleaning up test user: ${testEmail}`);
      try {
        await cognitoClient.send(
          new AdminDeleteUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: testEmail,
          })
        );
        console.log(`Successfully deleted test user: ${testEmail}`);
      } catch (error) {
        console.error(`Failed to delete user ${testEmail}:`, error);
      }
    } else {
      console.warn('Skipping cleanup: USER_POOL_ID environment variable is not set.');
    }
  });

  test('should register, confirm via SDK, and login successfully', async ({ page }) => {
    // 1. Go to register page
    await page.goto('/register');

    // 2. Fill out the signup form
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // 3. Wait for the redirect to verify or login page
    // (Depending on Cognito settings, it might auto-redirect to /verify to ask for a code)
    await page.waitForURL(/\/verify|\/login/);

    // 4. Force confirm the user using AWS SDK to bypass email verification
    if (!USER_POOL_ID) {
      test.skip(true, 'USER_POOL_ID is not set. Skipping the rest of the test.');
      return;
    }

    console.log(`Confirming user ${testEmail} via AWS SDK...`);
    await cognitoClient.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: USER_POOL_ID,
        Username: testEmail,
      })
    );

    // 5. Navigate to login and sign in to trigger JIT provisioning
    await page.goto('/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // 6. Wait for successful login redirect
    // Assuming successful login redirects to the root / or dashboard
    await page.waitForURL('/');
    
    // Verify we reached the main app page
    await expect(page.locator('body')).toBeVisible();
  });
});