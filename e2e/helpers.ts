import type { Page } from "@playwright/test";

/** Insere uma peça com duplo clique e a desloca com Shift+setas (50 unidades por toque). */
export async function add(page: Page, type: string, dx: number, dy: number): Promise<string> {
  await page.getByTestId(`library-item-${type}`).dblclick();
  const id = await page.locator('[data-component-id][aria-pressed="true"]').getAttribute("data-component-id");
  for (let k = 0; k < Math.abs(dx); k++) await page.keyboard.press(dx > 0 ? "Shift+ArrowRight" : "Shift+ArrowLeft");
  for (let k = 0; k < Math.abs(dy); k++) await page.keyboard.press(dy > 0 ? "Shift+ArrowDown" : "Shift+ArrowUp");
  return id!;
}

export async function portCenter(page: Page, id: string, port: string) {
  const b = (await page.locator(`[data-component-id="${id}"] [data-port-id="${port}"] .port-dot`).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Liga dois conectores arrastando com o mouse (soltando um pouco fora do alvo, como uma pessoa faria). */
export async function wire(page: Page, a: string, pa: string, b: string, pb: string) {
  const s = await portCenter(page, a, pa);
  const t = await portCenter(page, b, pb);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move((s.x + t.x) / 2, (s.y + t.y) / 2, { steps: 4 });
  await page.mouse.move(t.x + 4, t.y + 3, { steps: 4 });
  await page.mouse.up();
}

/** Monta: fonte → 3/2 NF botão → cilindro de simples ação. */
export async function buildDirectCircuit(page: Page) {
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
export async function rodX(page: Page, cyl: string) {
  return (await page.locator(`[data-component-id="${cyl}"] rect.sym-solid`).boundingBox())!.x;
}
