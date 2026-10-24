import { test as setup, expect } from '@playwright/test';
import { STORAGE, USERS } from './support/test-data';

// Signs in through the API once per role and saves the session cookie.
// Other tests reuse it with test.use({ storageState: STORAGE.staff }),
// so they don't repeat the login UI every time.
for (const role of ['admin', 'staff'] as const) {
  setup(`authenticate as ${role}`, async ({ request }) => {
    const { email, password } = USERS[role];
    const response = await request.post('/api/login', { data: { email, password } });
    expect(response.status()).toBe(200);
    await request.storageState({ path: STORAGE[role] });
  });
}
