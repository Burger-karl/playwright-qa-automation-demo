import { test, expect } from '@playwright/test';
import { STORAGE, buildApplicant } from './support/test-data';

// API-level tests: faster than UI tests and they check the server rules directly,
// so a bypassed or broken frontend can't hide a backend defect.

test.describe('Applicants API: signed out', () => {
  test('rejects requests without a session', async ({ request }) => {
    const response = await request.post('/api/applicants', { data: buildApplicant() });
    expect(response.status()).toBe(401);
  });
});

test.describe('Applicants API: signed in', () => {
  test.use({ storageState: STORAGE.staff });

  test('creates an applicant and normalises the data', async ({ request }) => {
    const input = buildApplicant({ fullName: '  Ngozi Eze  ', phone: '+234 801-234-5678' });

    const response = await request.post('/api/applicants', {
      data: { ...input, email: input.email.toUpperCase(), consent: true },
    });

    expect(response.status()).toBe(201);
    const { applicant } = await response.json();
    expect(applicant).toMatchObject({
      fullName: 'Ngozi Eze',
      email: input.email.toLowerCase(),
      phone: '+2348012345678',
      track: input.track,
    });
    expect(applicant.id).toEqual(expect.any(Number));
    expect(Date.parse(applicant.createdAt)).not.toBeNaN();
  });

  test('returns field-level errors for invalid data', async ({ request }) => {
    const response = await request.post('/api/applicants', {
      data: { fullName: '', email: 'bad', phone: '1', track: 'unknown', consent: false },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(Object.keys(body.fields).sort()).toEqual(['consent', 'email', 'fullName', 'phone', 'track']);
  });

  test('rejects consent sent as a string instead of a boolean', async ({ request }) => {
    const response = await request.post('/api/applicants', {
      data: { ...buildApplicant(), consent: 'true' },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).fields).toHaveProperty('consent');
  });

  // Raw bytes are sent as-is. A plain string would be JSON-encoded by Playwright first.
  const badBodies = [
    { name: 'malformed JSON', body: '{"fullName": "unterminated' },
    { name: 'a JSON string instead of an object', body: '"just a string"' },
    { name: 'a JSON array instead of an object', body: '[1, 2, 3]' },
  ];

  for (const { name, body } of badBodies) {
    test(`rejects ${name}`, async ({ request }) => {
      const response = await request.post('/api/applicants', {
        headers: { 'Content-Type': 'application/json' },
        data: Buffer.from(body),
      });

      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid JSON body.' });
    });
  }

  test('returns 409 for a duplicate email, regardless of letter case', async ({ request }) => {
    const applicant = buildApplicant();

    const first = await request.post('/api/applicants', { data: { ...applicant, consent: true } });
    expect(first.status()).toBe(201);

    const duplicate = await request.post('/api/applicants', {
      data: { ...applicant, email: applicant.email.toUpperCase(), consent: true },
    });
    expect(duplicate.status()).toBe(409);
    expect((await duplicate.json()).fields.email).toBe('An applicant with this email already exists.');
  });
});
