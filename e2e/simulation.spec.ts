import { expect, test } from "@playwright/test";
import { buildDirectCircuit, rodX } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("canvas")).toBeVisible();
});

test("liga linhas arrastando de um conector até outro", async ({ page }) => {
  await buildDirectCircuit(page);
  await expect(page.locator("[data-wire-id]")).toHaveCount(2);
  await page.keyboard.press("Control+z");
  await expect(page.locator("[data-wire-id]")).toHaveCount(1);
});

test("simula: apertar o botão avança o cilindro e soltar faz voltar", async ({ page }) => {
  const { cyl, valve } = await buildDirectCircuit(page);
  const rest = await rodX(page, cyl);

  await page.getByTestId("sim-play").click();
  await expect(page.getByTestId("sim-legend")).toBeVisible();
  await expect(page.locator("[data-wire-id] .wire-pressurized")).toHaveCount(1); // só a linha da fonte

  const box = (await page.locator(`[data-component-id="${valve}"]`).boundingBox())!;
  await page.mouse.move(box.x + 12, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => rodX(page, cyl)).toBeGreaterThan(rest + 40);
  await expect(page.locator("[data-wire-id] .wire-pressurized")).toHaveCount(2);
  await page.mouse.up();
  await expect.poll(() => rodX(page, cyl)).toBeLessThan(rest + 1);

  // Edição travada durante a simulação: Delete não apaga nada.
  await page.keyboard.press("Delete");
  await expect(page.locator("[data-component-id]")).toHaveCount(3);

  await page.getByTestId("sim-stop").click();
  await expect(page.getByTestId("sim-legend")).toHaveCount(0);
  await expect(page.locator("[data-wire-id] .wire-pressurized")).toHaveCount(0);
});

test("F5 inicia e Esc para a simulação", async ({ page }) => {
  await buildDirectCircuit(page);
  await page.locator("body").press("F5");
  await expect(page.getByTestId("sim-legend")).toBeVisible();
  await page.locator("body").press("Escape");
  await expect(page.getByTestId("sim-legend")).toHaveCount(0);
});
