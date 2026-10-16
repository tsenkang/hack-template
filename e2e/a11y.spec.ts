import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Auditoria automática (WCAG 2.1 AA) com o axe nos dois temas e com um circuito aberto. */
for (const theme of ["light", "dark"] as const) {
  test(`acessibilidade sem violações graves (tema ${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript((t) => localStorage.setItem("fluxolab:theme", t), theme);
    await page.goto("/");
    await page.getByRole("tab", { name: "Circuitos" }).click();
    await page.getByTestId("circuit-e-seal").click();
    await page.keyboard.press("0");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
}

test("teclado: Tab chega às peças, Enter seleciona e Espaço aciona na simulação", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Circuitos" }).click();
  await page.getByTestId("circuit-p-direct-sa").click();
  const valve = page.locator('[data-type="pneu.valve.3-2-nc.button-spring"]');
  await valve.focus();
  await page.keyboard.press("Enter");
  await expect(valve).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("sim-play").click();
  await valve.focus();
  await page.keyboard.down("Space");
  await expect.poll(async () => page.locator('[data-type="pneu.cylinder.single-acting"]').getAttribute("aria-label")).toBeTruthy();
  await expect(page.locator("[data-wire-id] .wire-pressurized")).toHaveCount(2, { timeout: 5000 });
  await page.keyboard.up("Space");
});
