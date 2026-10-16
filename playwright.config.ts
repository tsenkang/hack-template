import { defineConfig, devices } from "@playwright/test";

// Os testes de tela rodam contra o build de produção (pasta out/), igual ao site publicado.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  // locale pt-BR: o app escolhe o idioma pelo navegador, e os testes leem os textos em português.
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure", locale: "pt-BR" },
  projects: [
    {
      name: "chromium",
      testIgnore: /performance\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // Permite usar um Chromium já instalado na máquina (ex.: PW_CHROMIUM_PATH=/opt/...).
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
      },
    },
    {
      // Medição de quadros por segundo: roda sozinha, depois dos outros testes (sem disputar a CPU).
      name: "desempenho",
      testMatch: /performance\.spec\.ts/,
      dependencies: ["chromium"],
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
      },
    },
  ],
  webServer: {
    command: "npx serve out -l 4173 --no-clipboard",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
