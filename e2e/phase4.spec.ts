import { expect, test } from "@playwright/test";
import path from "node:path";
import { rodX } from "./helpers";

test("eletropneumática: S1 liga o selo, Y1 avança o cilindro e o sensor acende H1", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Abrir/ }).click();
  await page.getByTestId("import-input").setInputFiles(path.join(__dirname, "fixtures", "electro-seal.json"));
  await expect(page.locator("[data-component-id]")).toHaveCount(17);
  // numeração do esquema em escada: 4 colunas e a tabela de contatos de K1
  await expect(page.getByTestId("ladder").locator(".ladder-number")).toHaveCount(4);
  await page.keyboard.press("0");
  const rest = await rodX(page, "k14");

  await page.getByTestId("sim-play").click();
  const s1 = (await page.locator('[data-component-id="k2"]').boundingBox())!;
  await page.mouse.click(s1.x + 15, s1.y + s1.height / 2);

  await expect(page.locator('[data-component-id="k3"] rect.sym-energized')).toHaveCount(1); // K1
  await expect.poll(() => rodX(page, "k14")).toBeGreaterThan(rest + 40);
  await expect(page.locator('[data-component-id="k12"] circle[style*="fill"]')).toHaveCount(1); // H1 acesa
  await expect(page.locator("[data-wire-id] .wire-current")).not.toHaveCount(0);

  // S2 (NF) desliga o selo: tudo volta
  const s2 = (await page.locator('[data-component-id="k1"]').boundingBox())!;
  await page.mouse.click(s2.x + 15, s2.y + s2.height / 2);
  await expect(page.locator('[data-component-id="k3"] rect.sym-energized')).toHaveCount(0);
  await expect.poll(() => rodX(page, "k14")).toBeLessThan(rest + 1);
});
