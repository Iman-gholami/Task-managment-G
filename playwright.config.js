// @ts-check
const { defineConfig, devices } = require("@playwright/test");

const PORT = process.env.PORT || 3100;

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    // Set CHROMIUM_PATH to use a system Chromium instead of `npx playwright install chromium`.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/dashboard`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
