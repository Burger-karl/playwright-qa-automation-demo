# Playwright QA Automation Demo

[![Playwright Tests](https://github.com/Burger-karl/playwright-qa-automation-demo/actions/workflows/playwright.yml/badge.svg)](https://github.com/Burger-karl/playwright-qa-automation-demo/actions/workflows/playwright.yml)

End-to-end and API test suite, written with [Playwright](https://playwright.dev) and TypeScript, for a small demo operations portal. It covers sign-in, role-based permissions and an applicant onboarding form, and runs on every push and pull request in GitHub Actions.

The app under test (`app/`) is a deliberately small Node.js server with plain HTML pages and no dependencies, so the focus stays on the tests.

## What the suite covers

| Area | What is tested | Techniques |
| --- | --- | --- |
| Authentication | Valid sign-in, wrong password, empty form, case-insensitive email, protected-page redirect, sign-out ends the session | UI tests, network request assertions |
| Permissions | Staff can't see or open the admin page; the admin API returns 403 for staff; admin sees the user list; passwords are never exposed | UI and API checks of the same rule |
| Onboarding form | Happy path, required fields, invalid email and phone, unchecked terms, focus on the first error, accessible error states | Data-driven negative tests, `aria-invalid` checks |
| Duplicate prevention | Same email (any letter case) is rejected; a double-click sends only one request | Request counting, server-side 409 check |
| Error handling | Server 500 and network failure show clear messages and re-enable the form | Network mocking with `page.route` |
| API contract | 401 without a session, field-level validation errors, data normalisation, malformed and non-object JSON bodies, 409 duplicates | Playwright `request` fixture |

Tests run on a desktop Chrome viewport and a mobile (Pixel 7) viewport.

## Running locally

Requires Node.js 20 or later.

```bash
npm install
npx playwright install chromium
npm test                # all tests, headless; starts the app automatically
npm run test:headed     # watch the browser run
npm run test:ui         # Playwright UI mode, good for debugging
npm run test:api        # API tests only
npm run report          # open the last HTML report
```

To use the app by hand, run `npm start` and open http://localhost:3000.

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@demo.test | Admin123! |
| Staff | staff@demo.test | Staff123! |

These are demo-only accounts for a local test app.

## How it's built

```
app/                      Demo app under test (Node.js, no dependencies)
tests/
  auth.setup.ts           Signs in once per role and saves the session
  auth.spec.ts            Sign-in and sign-out
  permissions.spec.ts     Role-based access, UI and API
  onboarding.spec.ts      Form validation, duplicates, error handling
  api.spec.ts             API contract tests
  pages/                  Page objects (locators and actions per page)
  support/fixtures.ts     Page objects injected as Playwright fixtures
  support/test-data.ts    Accounts, test data builders, unique emails
playwright.config.ts      Projects, retries, traces, web server
.github/workflows/        CI pipeline
```

Design choices:

- **Session reuse:** `auth.setup.ts` signs in through the API once per role and stores the session with `storageState`. Tests start already signed in, which keeps them fast and independent.
- **Page objects as fixtures:** tests ask for `loginPage` or `onboardingPage` instead of building locators themselves.
- **User-facing locators:** `getByLabel` and `getByRole` first, so tests break when the experience breaks, not when a CSS class changes.
- **Parallel-safe data:** every applicant gets a unique email, so tests never collide when running in parallel.
- **Same rule, two layers:** permissions and validation are checked in the UI and directly against the API, so a hidden button can't mask a backend gap.

## Continuous integration

`.github/workflows/playwright.yml` runs on every push and pull request to `main`:

1. Install dependencies with `npm ci`
2. Type-check the tests
3. Install Chromium and run the full suite (2 retries in CI, `test.only` blocked)
4. Upload the HTML report, plus traces, screenshots and videos when a test fails

Download the `playwright-report` artifact from a workflow run and open `index.html` to see results.

## Defect log

Defects found by this suite while building it:

| # | Defect | Severity | Found by | Fix | Retest |
| --- | --- | --- | --- | --- | --- |
| 1 | `POST /api/applicants` accepted a JSON string or array as the body and returned field validation errors instead of rejecting the request as invalid JSON | Low | API contract test | Server now accepts only JSON objects | Passed, covered by 3 regression tests |

Bugs are reported with the template in `.github/ISSUE_TEMPLATE/bug_report.md`.
