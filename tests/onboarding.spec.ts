import { test, expect } from './support/fixtures';
import { STORAGE, buildApplicant } from './support/test-data';

test.use({ storageState: STORAGE.staff });

test.describe('Applicant onboarding', () => {
  test.beforeEach(async ({ onboardingPage }) => {
    await onboardingPage.goto();
  });

  test('submits a valid application and resets the form', async ({ onboardingPage }) => {
    const applicant = buildApplicant({ fullName: 'Tunde Bakare' });

    await onboardingPage.submit(applicant);

    await expect(onboardingPage.successMessage).toHaveText('Application received for Tunde Bakare.');
    await expect(onboardingPage.fullName).toHaveValue('');
    await expect(onboardingPage.consent).not.toBeChecked();
  });

  test('shows every required-field error on an empty submit, without calling the API', async ({ page, onboardingPage }) => {
    let apiCalls = 0;
    page.on('request', (req) => {
      if (req.url().endsWith('/api/applicants')) apiCalls++;
    });

    await onboardingPage.submitButton.click();

    await expect(onboardingPage.fieldError('fullName')).toHaveText('Full name is required.');
    await expect(onboardingPage.fieldError('email')).toHaveText('Enter a valid email address.');
    await expect(onboardingPage.fieldError('phone')).toHaveText('Enter a valid phone number (10 to 14 digits).');
    await expect(onboardingPage.fieldError('track')).toHaveText('Select a track.');
    await expect(onboardingPage.fieldError('consent')).toHaveText('You must accept the terms.');
    await expect(onboardingPage.fullName).toBeFocused();
    expect(apiCalls).toBe(0);
  });

  // Negative cases run as separate tests, so one failure doesn't hide the others.
  const invalidInputs = [
    { field: 'email', value: 'not-an-email', error: 'Enter a valid email address.' },
    { field: 'email', value: 'missing@tld', error: 'Enter a valid email address.' },
    { field: 'phone', value: '12345', error: 'Enter a valid phone number (10 to 14 digits).' },
    { field: 'phone', value: '+234-abc-0000', error: 'Enter a valid phone number (10 to 14 digits).' },
    { field: 'fullName', value: ' ', error: 'Full name is required.' },
  ] as const;

  for (const { field, value, error } of invalidInputs) {
    test(`rejects ${field} "${value}"`, async ({ onboardingPage }) => {
      await onboardingPage.submit({ ...buildApplicant(), [field]: value });

      await expect(onboardingPage.fieldError(field)).toHaveText(error);
      await expect(onboardingPage.input(field)).toHaveAttribute('aria-invalid', 'true');
      await expect(onboardingPage.successMessage).toBeHidden();
    });
  }

  test('requires the terms to be accepted', async ({ onboardingPage }) => {
    await onboardingPage.submit(buildApplicant(), { acceptTerms: false });

    await expect(onboardingPage.fieldError('consent')).toHaveText('You must accept the terms.');
    await expect(onboardingPage.successMessage).toBeHidden();
  });

  test('prevents a duplicate applicant with the same email', async ({ onboardingPage }) => {
    const applicant = buildApplicant();

    await onboardingPage.submit(applicant);
    await expect(onboardingPage.successMessage).toContainText('Application received');

    // Same email in a different letter case should still count as a duplicate.
    await onboardingPage.submit({ ...applicant, email: applicant.email.toUpperCase() });

    await expect(onboardingPage.fieldError('email')).toHaveText('An applicant with this email already exists.');
    await expect(onboardingPage.successMessage).toBeHidden();
  });

  test('sends only one request when the submit button is double-clicked', async ({ page, onboardingPage }) => {
    let apiCalls = 0;
    page.on('request', (req) => {
      if (req.url().endsWith('/api/applicants') && req.method() === 'POST') apiCalls++;
    });

    await onboardingPage.fill(buildApplicant());
    await onboardingPage.submitButton.dblclick();

    await expect(onboardingPage.successMessage).toContainText('Application received');
    expect(apiCalls).toBe(1);
  });

  test('shows a clear message when the server fails', async ({ page, onboardingPage }) => {
    await page.route('**/api/applicants', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }),
    );

    await onboardingPage.submit(buildApplicant());

    await expect(onboardingPage.errorAlert).toHaveText('Something went wrong. Please try again.');
    await expect(onboardingPage.submitButton).toBeEnabled();
  });

  test('shows a clear message when the network is down', async ({ page, onboardingPage }) => {
    await page.route('**/api/applicants', (route) => route.abort('internetdisconnected'));

    await onboardingPage.submit(buildApplicant());

    await expect(onboardingPage.errorAlert).toHaveText('Network error. Check your connection and try again.');
    await expect(onboardingPage.submitButton).toBeEnabled();
  });
});
