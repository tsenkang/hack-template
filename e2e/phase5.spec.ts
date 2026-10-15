import { expect, test } from "@playwright/test";
import path from "node:path";
import { rodX } from "./helpers";

test("eletro-hidráulica: S1 energiza Y1, a 4/3 comuta e o cilindro avança; o manômetro marca pressão", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Abrir/ }).click();
  await page.getByTestId("import-input").setInputFiles(path.join(__dirname, "fixtures", "electro-hydraulic.json"));
  await expect(page.locator("[data-component-id]")).toHaveCount(16);
  await page.getByRole("tab", { name: /Avisos/ }).click();
  await expect(page.getByText("Nenhum problema encontrado.")).toBeVisible();
  await page.keyboard.press("0");
  const rest = await rodX(page, "k0");

  await page.getByTestId("sim-play").click();
  await expect(page.locator("[data-wire-id] .wire-oil-return")).not.toHaveCount(0); // bomba descarregando pelo centro tandem
  const s1 = (await page.locator('[data-component-id="k9"]').boundingBox())!;
  await page.mouse.move(s1.x + 15, s1.y + s1.height / 2);
  await page.mouse.down();
  await expect.poll(() => rodX(page, "k0")).toBeGreaterThan(rest + 30);
  await expect(page.locator("[data-wire-id] .wire-oil-pressure")).not.toHaveCount(0);
  await expect(page.locator('[data-component-id="k4"] text.sym-text')).toContainText("bar");
  await page.mouse.up();
});
