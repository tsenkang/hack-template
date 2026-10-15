import { expect, test } from "@playwright/test";

const canvas = '[data-testid="canvas"]';
const parts = "[data-component-id]";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(canvas)).toBeVisible();
});

test("mostra as 4 áreas da tela", async ({ page }) => {
  await expect(page.getByRole("tab", { name: "Biblioteca" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Propriedades" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Lista de peças" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Desfazer/ })).toBeVisible();
});

test("insere peça com duplo clique, edita parâmetro e desfaz", async ({ page }) => {
  await page.getByTestId("library-item-pneu.cylinder.double-acting").dblclick();
  await expect(page.locator(parts)).toHaveCount(1);
  const stroke = page.getByLabel("Curso (mm)");
  await stroke.fill("250");
  await stroke.press("Enter");
  await expect(stroke).toHaveValue("250");
  await page.keyboard.press("Escape");
  await page.locator(canvas).click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+z");
  await page.locator(parts).first().click();
  await expect(page.getByLabel("Curso (mm)")).toHaveValue("100");
  await page.keyboard.press("Control+z");
  await expect(page.locator(parts)).toHaveCount(0);
});

test("arrasta da biblioteca para o desenho e move a peça", async ({ page }) => {
  await page.getByTestId("library-item-pneu.source.air").dragTo(page.locator(canvas), { targetPosition: { x: 200, y: 200 } });
  const part = page.locator(parts).first();
  await expect(part).toBeVisible();
  const before = await part.boundingBox();
  const cx = before!.x + before!.width / 2;
  const cy = before!.y + before!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy + 60, { steps: 5 });
  await page.mouse.up();
  const after = await part.boundingBox();
  expect(after!.x).toBeGreaterThan(before!.x + 80);
});

test("busca filtra a biblioteca sem depender de acento", async ({ page }) => {
  await page.getByRole("searchbox", { name: "Buscar peça…" }).fill("valvula 5/2");
  await expect(page.getByTestId("library-item-pneu.valve.5-2.pilot-pilot")).toBeVisible();
  await expect(page.getByTestId("library-item-pneu.source.air")).toHaveCount(0);
});

test("salva automaticamente e reabre depois de recarregar", async ({ page }) => {
  await page.getByTestId("library-item-pneu.silencer").dblclick();
  await page.getByTestId("library-item-pneu.silencer").dblclick();
  await expect(page.locator(parts)).toHaveCount(2);
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.locator(parts)).toHaveCount(2);
  await expect(page.getByTestId("parts-list")).toContainText("Silenciador");
});

test("abas de circuito", async ({ page }) => {
  await page.getByRole("button", { name: "Novo circuito" }).click();
  await expect(page.getByRole("tab", { name: "Circuito 2" })).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("library-item-elec.lamp").dblclick();
  await page.getByRole("tab", { name: "Circuito 1" }).click();
  await expect(page.locator(parts)).toHaveCount(0);
});

test("exporta o projeto em .json", async ({ page }) => {
  await page.getByTestId("library-item-pneu.source.air").dblclick();
  await page.getByRole("button", { name: "Exportar" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /\.json/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.fluxolab\.json$/);
});

test("exporta o circuito como imagem SVG e PNG", async ({ page }) => {
  await page.getByTestId("library-item-pneu.valve.5-2.pilot-pilot").dblclick();
  for (const [name, ext] of [[/\.svg/, ".svg"], [/\.png/, ".png"]] as const) {
    await page.getByRole("button", { name: "Exportar" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name }).click();
    expect((await download).suggestedFilename().endsWith(ext)).toBe(true);
  }
});

test("alterna tema claro/escuro", async ({ page }) => {
  const html = page.locator("html");
  const wasDark = await html.evaluate((el) => el.classList.contains("dark"));
  await page.getByRole("button", { name: /Usar tema/ }).click();
  await expect(html).toHaveClass(wasDark ? "" : /dark/);
});
