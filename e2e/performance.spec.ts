import { expect, test } from "@playwright/test";
import path from "node:path";

/** Conta quadros desenhados pelo navegador durante `ms` milissegundos. */
async function fps(page: import("@playwright/test").Page, ms: number) {
  return page.evaluate(
    (duration) =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = (now: number) => {
          frames++;
          if (now - start < duration) requestAnimationFrame(tick);
          else resolve((frames * 1000) / (now - start));
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

/**
 * 150 peças (30 cilindros em ciclo contínuo) simulando.
 * - Vista de trabalho (zoom normal): só o que aparece na tela é redesenhado a cada quadro.
 * - Visão geral (todas as 150 peças na tela, zoom 30%).
 * Os limites abaixo valem para a máquina de CI (sem placa de vídeo); o valor medido vai para o log.
 */
test("150 peças simulando: quadros por segundo", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: /^Abrir/ }).click();
  await page.getByTestId("import-input").setInputFiles(path.join(__dirname, "fixtures", "perf-150.json"));
  await expect(page.locator("[data-component-id]")).toHaveCount(150);

  await page.getByTestId("sim-play").click();
  await expect(page.getByTestId("sim-legend")).toContainText("Simulando");
  await page.waitForTimeout(1000); // cilindros já em movimento contínuo
  const working = await fps(page, 3000);
  await page.keyboard.press("0");
  await page.waitForTimeout(500);
  const overview = await fps(page, 3000);
  console.log(`FPS com 150 peças simulando: vista de trabalho ${working.toFixed(1)}, visão geral ${overview.toFixed(1)}`);
  await expect(page.getByTestId("sim-legend")).not.toContainText("não está acompanhando");
  expect(working).toBeGreaterThanOrEqual(40);
  expect(overview).toBeGreaterThanOrEqual(25);
});
