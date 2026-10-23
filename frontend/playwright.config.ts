import { defineConfig, devices } from "@playwright/test";

// Перед запуском поднимите проект: docker compose up --build
// (нужны ENABLE_DEV_ENDPOINTS=1 и VITE_DEV_TOOLS=1 — в compose они включены).
export default defineConfig({
  testDir: "./e2e",
  workers: 1, // тесты делят одно событие и сбрасывают число мест
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    video: "on", // видео каждого прогона — в test-results/ (подойдёт для демонстрации)
  },
  projects: [
    { name: "mobile-360", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 740 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
