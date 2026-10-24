import { type Locator, type Page } from '@playwright/test';
import { type Applicant } from '../support/test-data';

export class OnboardingPage {
  readonly fullName: Locator;
  readonly email: Locator;
  readonly phone: Locator;
  readonly track: Locator;
  readonly consent: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;
  readonly errorAlert: Locator;

  constructor(readonly page: Page) {
    this.fullName = page.getByLabel('Full name');
    this.email = page.getByLabel('Email');
    this.phone = page.getByLabel('Phone');
    this.track = page.getByLabel('Track');
    this.consent = page.getByLabel('I agree to the programme terms');
    this.submitButton = page.getByRole('button', { name: 'Submit application' });
    // Located by id, not getByRole: role locators skip hidden elements, and the
    // banner is hidden while empty, which is exactly when negative tests check it.
    this.successMessage = page.locator('#form-success');
    this.errorAlert = page.locator('#form-error');
  }

  async goto() {
    await this.page.goto('/onboarding.html');
  }

  // The input for a field, e.g. input('email').
  input(field: keyof Applicant | 'consent'): Locator {
    return this.page.locator(`#${field}`);
  }

  // Error text shown under a single field, e.g. fieldError('email').
  fieldError(field: keyof Applicant | 'consent'): Locator {
    return this.page.locator(`#${field}-error`);
  }

  async fill(applicant: Applicant, { acceptTerms = true } = {}) {
    await this.fullName.fill(applicant.fullName);
    await this.email.fill(applicant.email);
    await this.phone.fill(applicant.phone);
    await this.track.selectOption(applicant.track);
    if (acceptTerms) await this.consent.check();
  }

  async submit(applicant: Applicant, options?: { acceptTerms?: boolean }) {
    await this.fill(applicant, options);
    await this.submitButton.click();
  }
}
