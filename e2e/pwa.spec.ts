import { expect, test } from "@playwright/test";

test("PWA: manifest, service worker e app abrindo e simulando sem internet", async ({ page, context }) => {
  await page.goto("/");
  const manifest = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifest).toBe("/manifest.webmanifest");
  const res = await page.request.get(manifest!);
  const json = await res.json();
  expect(json.display).toBe("standalone");
  expect(json.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);

  // espera o service worker instalar e assumir a página
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("canvas")).toBeVisible();
  // simulação offline: o Web Worker também vem do cache
  await page.getByRole("tab", { name: "Circuitos" }).click();
  await page.getByTestId("circuit-p-direct-da").click();
  await page.getByTestId("sim-play").click();
  await expect(page.getByTestId("sim-legend")).toContainText("Simulando");
  await expect.poll(() => page.getByTestId("sim-legend").textContent(), { timeout: 5000 }).not.toContain("t = 0,00 s");
  await context.setOffline(false);
});
