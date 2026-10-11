import { defineConfig } from "@playwright/test";
const port = Number(process.env.TEST_PORT || 3173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("TEST_PORT must be an integer between 1024 and 65535.");
const localURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  use: {
    baseURL: process.env.TEST_BASE_URL || localURL,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  reporter: "list",
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: `npm run start -- --port ${port}`,
        url: localURL,
        reuseExistingServer: false,
        env: {
          DATABASE_URL: "",
          VERCEL: "",
          APIFY_TOKEN: "",
          GEMINI_API_KEY: "",
          LIVE_SCAN_BUDGET_USD: "0",
          SCAN_DB_PATH: ".data/browser-tests.sqlite",
          DEVELOPER_ACCESS_KEY:
            process.env.TEST_DEVELOPER_ACCESS_KEY ||
            "local-browser-test-access-" + "a".repeat(40),
        },
      },
});
