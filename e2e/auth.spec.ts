import { test, expect } from '@playwright/test';
import {
  CognitoIdentityProviderClient,
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
      } catch (error: any) {
        if (error.name !== 'UserNotFoundException') {
          console.error(`Failed to delete user ${testEmail}:`, error);
        }
      }
    } else {
      console.warn('Skipping cleanup: USER_POOL_ID environment variable is not set.');
    }
  });

  test('should register, auto-confirm via PreSignUp trigger, and login successfully', async ({ page }) => {
    // 1. Go to register page
    await page.goto('/register');

    // 2. Fill out the signup form
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.getByRole('button', { name: 'Sign up' }).click();

    // 3. Wait for the redirect to login page (auto-confirmed by PreSignUp lambda)
    await page.waitForURL('/login');

    // 4. Navigate to login and sign in to trigger JIT provisioning
    await page.goto('/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // 5. Wait for successful login redirect
    await page.waitForURL('/dashboard');
    
    // Verify we reached the dashboard and the profile was provisioned/loaded
    // (This ensures the ProtectedRoute guard has finished loading)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
  });
});
