// @ts-check
const { defineConfig, devices } = require("@playwright/test");

const path = require("node:path");
const os = require("node:os");

const PORT = process.env.PORT || 3100;
// Every test run starts from a fresh, seeded database.
const DB = path.join(os.tmpdir(), `sentinel-test-${Date.now()}.db`);

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  workers: 1, // tests share one database
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    // Set CHROMIUM_PATH to use a system Chromium instead of `npx playwright install chromium`.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `node scripts/next.mjs start -p ${PORT}`,
    env: { DATABASE_PATH: DB },
    url: `http://localhost:${PORT}/dashboard`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
