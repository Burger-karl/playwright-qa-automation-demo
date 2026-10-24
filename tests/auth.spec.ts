import { test, expect } from './support/fixtures';
import { USERS } from './support/test-data';

test.describe('Authentication', () => {
  test('signs in with valid credentials and lands on the dashboard', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(USERS.staff.email, USERS.staff.password);

    await expect(page).toHaveURL(/\/dashboard\.html$/);
    await expect(page.getByRole('heading', { name: `Welcome, ${USERS.staff.name}` })).toBeVisible();
    await expect(page.locator('#role')).toHaveText('staff');
  });

  test('accepts the email in any letter case', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(USERS.staff.email.toUpperCase(), USERS.staff.password);

    await expect(page).toHaveURL(/\/dashboard\.html$/);
  });

  test('rejects a wrong password and stays on the login page', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(USERS.staff.email, 'wrong-password');

    await expect(loginPage.errorAlert).toHaveText('Invalid email or password.');
    await expect(page).toHaveURL(/\/login\.html$/);
  });

  test('blocks empty submissions without calling the API', async ({ page, loginPage }) => {
    const loginRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().endsWith('/api/login')) loginRequests.push(req.url());
    });

    await loginPage.goto();
    await loginPage.submitButton.click();

    await expect(loginPage.errorAlert).toHaveText('Email and password are required.');
    expect(loginRequests).toHaveLength(0);
  });

  test('redirects signed-out visitors away from protected pages', async ({ page }) => {
    await page.goto('/dashboard.html');
    await expect(page).toHaveURL(/\/login\.html$/);
  });

  test('signing out ends the session', async ({ page, loginPage }) => {
    // Uses its own login (not the shared session) because signing out destroys the session.
    await loginPage.goto();
    await loginPage.login(USERS.staff.email, USERS.staff.password);
    await expect(page).toHaveURL(/\/dashboard\.html$/);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login\.html$/);

    const me = await page.request.get('/api/me');
    expect(me.status()).toBe(401);

    await page.goto('/dashboard.html');
    await expect(page).toHaveURL(/\/login\.html$/);
  });
});
