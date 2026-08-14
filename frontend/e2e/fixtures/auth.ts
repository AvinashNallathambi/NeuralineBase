import { test as base, expect, type Page } from '@playwright/test';
import { readAuthState, type E2EState } from '../global.setup';

export type TestFixtures = {
  authenticatedPage: Page;
  e2eState: E2EState;
};

export const test = base.extend<TestFixtures>({
  e2eState: async ({}, use) => {
    use(readAuthState());
  },

  authenticatedPage: async ({ page, e2eState }, use) => {
    // Seed the staff session in sessionStorage. The store's isAuthenticated
    // flag is derived from the token key, so this is enough for the route guard
    // and API interceptor to function.
    await page.goto('/login');
    await page.evaluate((token) => {
      sessionStorage.setItem('neuraline_token', token);
    }, e2eState.token);

    await use(page);
  },
});

export { expect };
