import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4321",
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    launchOptions: { executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] },
  },
  webServer: {
    command: "node e2e/serve.mjs",
    url: "http://localhost:4321/ms/",
    reuseExistingServer: true,
  },
});
