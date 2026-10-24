import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT) || 3000;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI, // fail CI if a test.only is committed by mistake
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Signs in once per role and saves the session for the other projects.
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup'],
      testIgnore: /api\.spec\.ts/, // API tests don't depend on the viewport
    },
  ],

  // Starts the demo app before the tests and stops it afterwards.
  webServer: {
    command: 'node app/server.js',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !isCI,
    env: { PORT: String(PORT) },
  },
});
