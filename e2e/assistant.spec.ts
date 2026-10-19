import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const spec = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "assistant-spec.json"), "utf8"));

/** Resposta da API no formato de mensagem (só os campos que o app lê). */
const message = (content: unknown[], stop_reason: string) => ({
  id: `msg_${Math.random().toString(36).slice(2)}`,
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content,
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

test("assistente: escolhe o nível, monta o circuito, confere e abre no desenho", async ({ page }) => {
  const bodies: { output_config?: { effort?: string }; messages: unknown[] }[] = [];
  await page.route("https://api.anthropic.com/v1/messages**", async (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    const reply =
      bodies.length === 1
        ? message([{ type: "tool_use", id: "toolu_1", name: "build_circuit", input: spec }], "tool_use")
        : message([{ type: "text", text: "Pronto: o cilindro avança com S1 e volta pelo rolete S2." }], "end_turn");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) });
  });

  await page.goto("/");
  await page.getByTestId("start-assistant").click();
  await expect(page.getByTestId("assistant-panel")).toBeVisible();
  await page.getByTestId("assistant-key").fill("sk-ant-teste");
  await page.getByRole("button", { name: "Salvar chave" }).click();

  await page.getByTestId("assistant-level-intermediate").click();
  await expect(page.getByTestId("assistant-level-intermediate")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("assistant-input").fill("Um toque no botão avança o cilindro e ele volta sozinho no fim do curso");
  await page.getByTestId("assistant-run").click();

  await expect(page.getByTestId("assistant-result")).toContainText("Circuito montado e conferido", { timeout: 15000 });
  await expect(page.getByTestId("assistant-result")).toContainText("A1+ A1-");
  await expect(page.locator("[data-component-id]")).toHaveCount(5);
  // o nível escolhido vira o esforço do raciocínio; a 2ª chamada leva o relatório da conferência
  expect(bodies[0].output_config?.effort).toBe("medium");
  expect(JSON.stringify(bodies[1].messages)).toContain("RESULTADO: OK");

  // nível e chave ficam salvos
  await page.reload();
  await page.getByRole("tab", { name: "Assistente" }).click();
  await expect(page.getByTestId("assistant-level-intermediate")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("assistant-input")).toBeVisible();
});

test("assistente: chave recusada mostra o erro e deixa trocar", async ({ page }) => {
  await page.route("https://api.anthropic.com/v1/messages**", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }) }),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Assistente" }).click();
  await page.getByTestId("assistant-key").fill("sk-ant-errada");
  await page.getByRole("button", { name: "Salvar chave" }).click();
  await page.getByTestId("assistant-input").fill("cilindro com botão");
  await page.getByTestId("assistant-run").click();
  await expect(page.getByTestId("assistant-error")).toContainText("não foi aceita");
  await page.getByTestId("assistant-error").getByRole("button", { name: "Trocar chave" }).click();
  await expect(page.getByTestId("assistant-key-form")).toBeVisible();
});
