import { defineConfig, devices } from "@playwright/test";

// Test servers serve the production build (dist/). Ports from 5183 up, never 4191 or 4291.
const ROOT_PORT = 5193;
const SUB_PORT = 5194;
const SUB_PREFIX = "/a/b/";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  fullyParallel: true,
  forbidOnly: true,
  reporter: [["list"]],
  use: { trace: "off" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${ROOT_PORT}/` } },
    { name: "webkit", use: { ...devices["Desktop Safari"], baseURL: `http://127.0.0.1:${ROOT_PORT}/` } },
    {
      name: "chromium-subpath",
      grep: /@subpath/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${SUB_PORT}${SUB_PREFIX}` },
    },
    {
      name: "webkit-subpath",
      grep: /@subpath/,
      use: { ...devices["Desktop Safari"], baseURL: `http://127.0.0.1:${SUB_PORT}${SUB_PREFIX}` },
    },
  ],
  webServer: [
    {
      command: `node scripts/serve-subpath.mjs dist / ${ROOT_PORT}`,
      url: `http://127.0.0.1:${ROOT_PORT}/`,
      reuseExistingServer: false,
    },
    {
      command: `node scripts/serve-subpath.mjs dist ${SUB_PREFIX} ${SUB_PORT}`,
      url: `http://127.0.0.1:${SUB_PORT}${SUB_PREFIX}`,
      reuseExistingServer: false,
    },
  ],
});
