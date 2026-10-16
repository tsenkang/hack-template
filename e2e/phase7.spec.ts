import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("canvas")).toBeVisible();
});

test("exporta PDF com uma página por aba e a lista de peças", async ({ page }) => {
  await page.getByRole("tab", { name: "Circuitos" }).click();
  await page.getByTestId("circuit-e-seal").click();
  await page.getByRole("button", { name: "Exportar" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /PDF/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const bytes = readFileSync((await download.path())!);
  if (process.env.PDF_OUT) await download.saveAs(process.env.PDF_OUT);
  const text = bytes.toString("latin1");
  expect(text.startsWith("%PDF-1.4")).toBe(true);
  expect(text).toContain("/Count 3"); // 2 abas + lista de peças
  expect(text).toContain("/Filter /DCTDecode");
  expect(text).toContain("Lista de pe\xe7as");
});

test.describe("tablet em pé (toque)", () => {
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });

  test("gavetas da biblioteca e das propriedades; tocar no botão aciona a válvula", async ({ page }) => {
    await expect(page.getByTestId("left-panel")).toBeHidden();
    await page.getByTestId("toggle-left").tap();
    await expect(page.getByTestId("left-panel")).toBeVisible();
    await page.getByRole("tab", { name: "Circuitos" }).tap();
    await page.getByTestId("circuit-p-direct-sa").tap();
    await page.getByLabel("Fechar").first().tap();
    await expect(page.getByTestId("left-panel")).toBeHidden();
    await page.getByTestId("toggle-right").tap();
    await expect(page.getByTestId("right-panel")).toBeVisible();
    await page.getByTestId("toggle-right").tap();

    await page.getByTestId("sim-play").tap();
    const valve = page.locator('[data-type="pneu.valve.3-2-nc.button-spring"]');
    const box = (await valve.boundingBox())!;
    // toque e segura no botão da válvula (o lado esquerdo do símbolo)
    const client = await page.context().newCDPSession(page);
    const point = { x: box.x + 10, y: box.y + box.height / 2 };
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await expect(page.locator("[data-wire-id] .wire-pressurized")).toHaveCount(2, { timeout: 5000 });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  });
});

test("modo apresentação esconde os painéis e volta com o botão Sair", async ({ page }) => {
  await page.getByRole("tab", { name: "Circuitos" }).click();
  await page.getByTestId("circuit-p-direct-da").click();
  await page.getByTestId("enter-presentation").click();
  await expect(page.getByTestId("presentation-bar")).toBeVisible();
  await expect(page.getByTestId("left-panel")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Gráficos" })).toHaveCount(0);
  await page.getByTestId("exit-presentation").click();
  await expect(page.getByRole("tab", { name: "Gráficos" })).toBeVisible();
});

test("troca de idioma: inglês e espanhol, e a escolha fica salva", async ({ page }) => {
  await page.getByTestId("locale-select").selectOption("en");
  await expect(page.getByRole("tab", { name: "Library" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.getByRole("tab", { name: "Library" })).toBeVisible();
  await page.getByTestId("locale-select").selectOption("es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByTestId("library-item-pneu.cylinder.double-acting")).toContainText("doble efecto");
  await page.getByTestId("locale-select").selectOption("pt-BR");
  await expect(page.getByRole("tab", { name: "Biblioteca" })).toBeVisible();
});
