/** Catálogo de peças em texto, para o assistente saber o que existe, os conectores e os parâmetros. */
import { ptBR } from "@/i18n/pt-BR";
import { COMPONENT_DEFS } from "@/symbols/registry";
import type { ParamDef } from "@/symbols/types";

const parts = ptBR.parts as Record<string, { name: string; description: string }>;

function param(p: ParamDef): string {
  switch (p.type) {
    case "number":
      return `${p.key}=${p.default}${p.unit ? p.unit : ""} [${p.min}..${p.max}]`;
    case "select":
      return `${p.key}=${p.default} (${p.options.join("|")})`;
    case "program":
      return `${p.key}=programa do CLP (objeto {rungs, steps, transitions})`;
    default:
      return `${p.key}=${JSON.stringify(p.default)}`;
  }
}

export function partCatalog(): string {
  return COMPONENT_DEFS.map((d) => {
    const ports = d.ports.map((p) => `${p.id}@${p.x},${p.y}${p.kind === "electric" ? "e" : p.kind.includes("pilot") ? "p" : p.kind === "hydraulic" ? "h" : ""}`).join(" ");
    const params = d.params.map(param).join(", ");
    const info = parts[d.type];
    return `${d.type} | ${info?.name ?? d.type} | ${d.width}x${d.height} | portas: ${ports}${params ? ` | params: ${params}` : ""} | ${info?.description ?? ""}`;
  }).join("\n");
}
