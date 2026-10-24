import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { OnboardingPage } from '../pages/onboarding-page';

type Pages = {
  loginPage: LoginPage;
  onboardingPage: OnboardingPage;
};

// Page objects are injected as fixtures, so tests ask for what they need:
//   test('...', async ({ onboardingPage }) => { ... })
export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  onboardingPage: async ({ page }, use) => {
    await use(new OnboardingPage(page));
  },
});

export { expect } from '@playwright/test';
