import { expect, test } from "@playwright/test";
import { add, buildDirectCircuit, portCenter, wire } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("canvas")).toBeVisible();
});

test("detector de erros: avisa, marca a peça e leva até ela", async ({ page }) => {
  const cyl = await add(page, "pneu.cylinder.double-acting", 0, 0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("warnings-count")).toHaveText("3"); // sem fonte + 2 conectores soltos
  await expect(page.getByTestId("diag-marker")).toHaveCount(1);
  await page.getByRole("tab", { name: /Avisos/ }).click();
  await page.getByTestId("warnings-list").getByText(/conector A está solto/).click();
  await expect(page.locator(`[data-component-id="${cyl}"]`)).toHaveAttribute("aria-pressed", "true");
});

test("soltar uma peça em cima de uma linha encaixa a peça no meio", async ({ page }) => {
  const src = await add(page, "pneu.source.air", 0, -2);
  const gauge = await add(page, "pneu.gauge.pressure", 0, 3);
  await page.keyboard.press("Escape");
  await wire(page, src, "1", gauge, "1");
  await expect(page.locator("[data-wire-id]")).toHaveCount(1);
  const a = await portCenter(page, src, "1");
  const b = await portCenter(page, gauge, "1");
  await page
    .getByTestId("library-item-pneu.check-valve")
    .dragTo(page.getByTestId("canvas"), {
      targetPosition: await (async () => {
        const box = (await page.getByTestId("canvas").boundingBox())!;
        return { x: (a.x + b.x) / 2 - box.x, y: (a.y + b.y) / 2 - box.y };
      })(),
    });
  await expect(page.locator("[data-component-id]")).toHaveCount(3);
  await expect(page.locator("[data-wire-id]")).toHaveCount(2);
});

test("diagrama de fases é desenhado durante a simulação", async ({ page }) => {
  const { valve } = await buildDirectCircuit(page);
  await page.getByTestId("sim-play").click();
  const box = (await page.locator(`[data-component-id="${valve}"]`).boundingBox())!;
  await page.mouse.move(box.x + 12, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.getByRole("tab", { name: "Diagrama de fases" }).click();
  await expect(page.getByTestId("phase-diagram")).toBeVisible();
  await expect(page.getByTestId("phase-diagram").locator("path.chart-line")).toHaveCount(1);
});

test("pergunta antes de simular um circuito com erro grave", async ({ page }) => {
  await add(page, "pneu.cylinder.double-acting", 0, 0);
  page.once("dialog", (d) => d.dismiss());
  await page.getByTestId("sim-play").click();
  await expect(page.getByTestId("sim-legend")).toHaveCount(0);
  await expect(page.getByTestId("warnings-list")).toBeVisible();
});
