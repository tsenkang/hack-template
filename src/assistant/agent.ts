/**
 * Assistente que monta circuitos: conversa com o Claude direto do navegador, com a
 * chave da API da própria pessoa (guardada só neste navegador). O Claude chama a
 * ferramenta build_circuit; o FluxoLab monta, confere e devolve o resultado, até o
 * circuito passar ou acabarem as tentativas.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Project } from "@/engine/core/types";
import type { Diagnostic } from "@/engine/diagnostics/static";
import { buildFromSpec, reportText, type BuildReport, type CircuitSpec } from "./spec";
import { LEVEL_EFFORT, levelPrompt, staticPrompt, type AssistantLevel } from "./prompt";

export const ASSISTANT_MODEL = "claude-opus-5-5";
const MAX_TURNS = 6;

export type AssistantStatus = { phase: "thinking" } | { phase: "building"; attempt: number } | { phase: "checking"; attempt: number };

export interface AssistantResult {
  report: BuildReport | null;
  steps: string[];
  message: string;
  attempts: number;
}

export class AssistantError extends Error {
  constructor(
    readonly kind: "auth" | "rate" | "network" | "refusal" | "overloaded" | "cancelled" | "nothing" | "other",
    message: string = kind,
  ) {
    super(message);
  }
}

const BUILD_TOOL: Anthropic.Beta.BetaTool = {
  name: "build_circuit",
  description:
    "Monta o circuito no FluxoLab (substitui o anterior), roda o detector de erros e, se houver `test`, simula e compara a sequência dos cilindros. Devolve um relatório: corrija e chame de novo até vir OK.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nome curto do projeto." },
      tabs: {
        type: "array",
        description: "Abas do projeto (ex.: Pneumática, Comando elétrico).",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            parts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ref: { type: "string", description: "Nome curto e único na aba, usado nas ligações." },
                  type: { type: "string", description: "Tipo exato do catálogo." },
                  x: { type: "number" },
                  y: { type: "number" },
                  label: { type: "string" },
                  rotation: { type: "number", enum: [0, 90, 180, 270] },
                  params: { type: "object", description: "Só os parâmetros que mudam do padrão." },
                },
                required: ["ref", "type", "x", "y"],
              },
            },
            wires: {
              type: "array",
              items: {
                type: "object",
                properties: { from: { type: "string" }, to: { type: "string" } },
                required: ["from", "to"],
              },
            },
          },
          required: ["parts", "wires"],
        },
      },
      test: {
        type: "object",
        properties: {
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                t: { type: "number" },
                target: { type: "string" },
                side: { type: "string", enum: ["left", "right"] },
                active: { type: "boolean" },
              },
              required: ["t", "target", "active"],
            },
          },
          duration: { type: "number" },
          expect: { type: "string" },
        },
        required: ["actions", "duration", "expect"],
      },
      steps: { type: "array", items: { type: "string" }, description: "Passo a passo para o aluno." },
    },
    required: ["tabs", "steps"],
  },
};

export async function runAssistant(o: {
  apiKey: string;
  description: string;
  level: AssistantLevel;
  locale: string;
  describe: (d: Diagnostic, project: Project) => string;
  onStatus: (s: AssistantStatus) => void;
  signal: AbortSignal;
}): Promise<AssistantResult> {
  const client = new Anthropic({ apiKey: o.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: o.description }];
  let best: { report: BuildReport; steps: string[] } | null = null;
  let attempts = 0;
  let message = "";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    o.onStatus({ phase: "thinking" });
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create(
        {
          model: ASSISTANT_MODEL,
          max_tokens: 16000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: LEVEL_EFFORT[o.level] },
          system: [
            { type: "text", text: staticPrompt(), cache_control: { type: "ephemeral" } },
            { type: "text", text: levelPrompt(o.level, o.locale) },
          ],
          tools: [BUILD_TOOL],
          messages,
        },
        { signal: o.signal },
      );
    } catch (err) {
      throw toAssistantError(err);
    }

    if (response.stop_reason === "refusal") throw new AssistantError("refusal");
    // Guarda a resposta inteira (inclusive os blocos de raciocínio) para a próxima volta.
    messages.push({ role: "assistant", content: response.content });
    message = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (calls.length === 0 || response.stop_reason !== "tool_use") break;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      if (call.name !== "build_circuit") {
        results.push({ type: "tool_result", tool_use_id: call.id, content: "Ferramenta desconhecida.", is_error: true });
        continue;
      }
      attempts++;
      o.onStatus({ phase: "building", attempt: attempts });
      const spec = call.input as CircuitSpec;
      o.onStatus({ phase: "checking", attempt: attempts });
      // deixa a tela mostrar "conferindo…" antes da simulação, que roda nesta mesma thread
      await new Promise((r) => setTimeout(r, 20));
      let report: BuildReport;
      try {
        report = buildFromSpec(spec);
      } catch (err) {
        results.push({ type: "tool_result", tool_use_id: call.id, content: `Erro ao montar: ${String(err)}`, is_error: true });
        continue;
      }
      if (!best || report.ok || !best.report.ok) best = { report, steps: Array.isArray(spec.steps) ? spec.steps.map(String) : [] };
      const text = reportText(report, o.describe) + (attempts >= 4 && !report.ok ? "\nÚltima tentativa: termine explicando o que falta." : "");
      results.push({ type: "tool_result", tool_use_id: call.id, content: text });
    }
    messages.push({ role: "user", content: results });
  }

  if (!best) throw new AssistantError("nothing", message);
  return { report: best.report, steps: best.steps, message, attempts };
}

function toAssistantError(err: unknown): AssistantError {
  if (err instanceof Anthropic.APIUserAbortError) return new AssistantError("cancelled");
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return new AssistantError("auth");
  if (err instanceof Anthropic.RateLimitError) return new AssistantError("rate");
  if (err instanceof Anthropic.APIConnectionError) return new AssistantError("network");
  if (err instanceof Anthropic.InternalServerError) return new AssistantError("overloaded");
  if (err instanceof Anthropic.APIError) return new AssistantError("other", `${err.status ?? ""} ${err.message}`);
  return new AssistantError("other", String(err));
}
