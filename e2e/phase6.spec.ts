import { expect, test } from "@playwright/test";
import { wire } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("canvas")).toBeVisible();
});

test("exercício é corrigido automaticamente: errado sem ligações, certo depois de montar", async ({ page }) => {
  await page.getByRole("tab", { name: "Exercícios" }).click();
  await page.getByTestId("exercise-ex-direct-sa").click();
  await expect(page.getByTestId("exercise-view")).toBeVisible();
  await expect(page.locator("[data-component-id]")).toHaveCount(2);

  await page.getByTestId("check-exercise").click();
  await expect(page.getByTestId("check-result")).toContainText("Ainda não");
  await expect(page.getByTestId("check-result")).toContainText("V1");

  // monta a solução: 3/2 NF com botão (vira V1) entre a fonte e o cilindro
  await page.keyboard.press("0");
  await page.getByRole("tab", { name: "Biblioteca" }).click();
  await page.getByTestId("library-item-pneu.valve.3-2-nc.button-spring").dblclick();
  await page.keyboard.press("Escape");
  await page.keyboard.press("0");
  const ids = await page.locator("[data-component-id]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-type"), e.getAttribute("data-component-id")]));
  const id = (type: string) => ids.find(([t]) => t === type)![1]!;
  await wire(page, id("pneu.source.air"), "1", id("pneu.valve.3-2-nc.button-spring"), "1");
  await wire(page, id("pneu.valve.3-2-nc.button-spring"), "2", id("pneu.cylinder.single-acting"), "A");
  await expect(page.locator("[data-wire-id]")).toHaveCount(2);

  await page.getByRole("tab", { name: "Exercícios" }).click();
  await page.getByTestId("check-exercise").click();
  await expect(page.getByTestId("check-result")).toContainText("Correto");
});

test("solução só aparece no modo Professor", async ({ page }) => {
  await page.getByRole("tab", { name: "Exercícios" }).click();
  await page.getByTestId("exercise-ex-indirect").click();
  await expect(page.getByTestId("show-solution")).toHaveCount(0);
  await page.getByTestId("role-select").selectOption("teacher");
  await expect(page.getByTestId("show-solution")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("show-solution").click();
  await expect(page.locator("[data-component-id]")).toHaveCount(4);
  await page.getByTestId("check-exercise").click();
  await expect(page.getByTestId("check-result")).toContainText("Correto");
});

test("Ctrl+K abre a paleta e carrega um circuito pronto com o roteiro", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await page.getByTestId("palette-input").fill("autorretenção");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("circuit-guide")).toContainText("Selo");
  await expect(page.getByRole("tab", { name: "Comando elétrico" })).toBeVisible();
});

test("biblioteca tem 40+ circuitos e o CLP mostra ladder ao vivo", async ({ page }) => {
  await page.getByRole("tab", { name: "Circuitos" }).click();
  expect(await page.locator('[data-testid^="circuit-"]').count()).toBeGreaterThanOrEqual(40);
  await page.getByTestId("circuit-c-seal").click();
  await expect(page.locator('[data-type="elec.plc"]')).toBeVisible();
  await page.keyboard.press("0");
  await page.locator('[data-type="elec.plc"]').dblclick();
  await expect(page.getByTestId("rung-0")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Fechar" }).click();

  await page.getByTestId("sim-play").click();
  const s1 = page.locator('[data-type="elec.pushbutton.no"]');
  const box = (await s1.boundingBox())!;
  await page.mouse.move(box.x + 8, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  // o CLP sela a saída Q0: a bobina Y1 fica energizada
  await expect(page.locator('[data-type="elec.solenoid.coil"] rect.sym-energized')).toHaveCount(1);
  await page.locator('[data-type="elec.plc"]').dblclick();
  await expect(page.getByTestId("plc-live")).toContainText("Q: 10000000");
});

test("gráficos ao vivo e modo Explique", async ({ page }) => {
  await page.getByRole("tab", { name: "Circuitos" }).click();
  await page.getByTestId("circuit-p-direct-da").click();
  await page.getByTestId("explain-toggle").click();
  await page.keyboard.press("0");
  await page.locator('[data-type="pneu.cylinder.double-acting"]').click();
  await expect(page.getByTestId("explain")).toContainText("Princípio");
  await page.getByRole("tab", { name: "Gráficos" }).click();
  await page.getByTestId("sim-play").click();
  await expect(page.getByTestId("charts").locator("path.chart-line")).not.toHaveCount(0);
  // durante a simulação, clicar no cilindro seleciona e explica o que ele faz agora
  await page.locator('[data-type="pneu.cylinder.double-acting"]').click();
  await expect(page.getByTestId("explain-now")).toContainText("haste");
});
