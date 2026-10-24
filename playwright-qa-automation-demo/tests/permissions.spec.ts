import { test, expect } from './support/fixtures';
import { STORAGE, USERS } from './support/test-data';

test.describe('Role-based access: staff', () => {
  test.use({ storageState: STORAGE.staff });

  test('does not see the admin link', async ({ page }) => {
    await page.goto('/dashboard.html');
    await expect(page.getByRole('heading', { name: `Welcome, ${USERS.staff.name}` })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin panel' })).toBeHidden();
  });

  test('is refused when opening the admin page directly', async ({ page }) => {
    await page.goto('/admin.html');

    await expect(page.getByRole('alert')).toHaveText('You do not have permission to view this page.');
    await expect(page.getByRole('table', { name: 'Users' })).toBeHidden();
  });

  test('gets 403 from the admin API (server enforces it, not just the UI)', async ({ request }) => {
    const response = await request.get('/api/admin/users');
    expect(response.status()).toBe(403);
  });
});

test.describe('Role-based access: admin', () => {
  test.use({ storageState: STORAGE.admin });

  test('sees the admin link and the user list', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.getByRole('link', { name: 'Admin panel' }).click();

    await expect(page).toHaveURL(/\/admin\.html$/);
    const table = page.getByRole('table', { name: 'Users' });
    await expect(table).toBeVisible();
    await expect(table.getByRole('row', { name: new RegExp(USERS.staff.email) })).toContainText('staff');
  });

  test('admin API never exposes passwords', async ({ request }) => {
    const response = await request.get('/api/admin/users');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.users.length).toBeGreaterThan(0);
    for (const user of body.users) {
      expect(user).not.toHaveProperty('password');
    }
  });
});
