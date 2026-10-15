import { expect, test, type Page } from "@playwright/test";

/** Insere uma peça com duplo clique e a desloca com Shift+setas (50 unidades por toque). */
async function add(page: Page, type: string, dx: number, dy: number): Promise<string> {
  await page.getByTestId(`library-item-${type}`).dblclick();
  const id = await page.locator('[data-component-id][aria-pressed="true"]').getAttribute("data-component-id");
  for (let k = 0; k < Math.abs(dx); k++) await page.keyboard.press(dx > 0 ? "Shift+ArrowRight" : "Shift+ArrowLeft");
  for (let k = 0; k < Math.abs(dy); k++) await page.keyboard.press(dy > 0 ? "Shift+ArrowDown" : "Shift+ArrowUp");
  return id!;
}

async function portCenter(page: Page, id: string, port: string) {
  const b = (await page.locator(`[data-component-id="${id}"] [data-port-id="${port}"] .port-dot`).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Liga dois conectores arrastando com o mouse (soltando um pouco fora do alvo, como uma pessoa faria). */
async function wire(page: Page, a: string, pa: string, b: string, pb: string) {
  const s = await portCenter(page, a, pa);
  const t = await portCenter(page, b, pb);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move((s.x + t.x) / 2, (s.y + t.y) / 2, { steps: 4 });
  await page.mouse.move(t.x + 4, t.y + 3, { steps: 4 });
  await page.mouse.up();
}

/** Monta: fonte → 3/2 NF botão → cilindro de simples ação. */
async function buildDirectCircuit(page: Page) {
  const cyl = await add(page, "pneu.cylinder.single-acting", 0, -3);
  const valve = await add(page, "pneu.valve.3-2-nc.button-spring", 0, 0);
  const src = await add(page, "pneu.source.air", -1, 3);
  await page.keyboard.press("Escape");
  await page.keyboard.press("0");
  await wire(page, src, "1", valve, "1");
  await wire(page, valve, "2", cyl, "A");
  return { cyl, valve, src };
}

/** Avanço da haste lido do desenho: posição do êmbolo dentro do corpo. */
async function rodX(page: Page, cyl: string) {
  return (await page.locator(`[data-component-id="${cyl}"] rect.sym-solid`).boundingBox())!.x;
}

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
