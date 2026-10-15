import type { ComponentType } from "react";
import type { ComponentSimState, SimSpec } from "@/engine/core/sim-types";
import type { Domain, ParamValue } from "@/engine/core/types";
import type { CategoryId } from "./categories";

/** Grade do desenho: todas as peças e conectores caem em múltiplos deste valor. */
export const GRID = 10;

/** Tipo de conector: define o que pode ser ligado com o quê. */
export type PortKind = "pneumatic" | "hydraulic" | "pilot" | "hydraulic-pilot" | "electric";

/** Conector de uma peça, em coordenadas locais do símbolo (antes de girar/espelhar). */
export interface PortDef {
  id: string;
  x: number;
  y: number;
  kind: PortKind;
  /** Escape (3, 5…): pode ficar solto sem aviso de vazamento. */
  exhaust?: boolean;
}

/** Parâmetro editável no painel de propriedades. */
export type ParamDef =
  | {
      key: string;
      type: "number";
      unit?: string;
      default: number;
      min: number;
      max: number;
      step?: number;
    }
  | { key: string; type: "boolean"; default: boolean }
  /** `autoLabel`: valor inicial numerado sozinho com este prefixo (ex.: "Y" → Y1, Y2…). */
  | { key: string; type: "text"; default: string; autoLabel?: string }
  | { key: string; type: "select"; default: string; options: string[] };

export interface SymbolProps {
  params: Record<string, ParamValue>;
  /** Estado da simulação (posição do êmbolo, da haste, pressão…). Ausente no modo de edição. */
  state?: ComponentSimState;
}

/**
 * Descrição completa de um tipo de peça.
 *
 * Os textos (nome, descrição, parâmetros) ficam no i18n, nas chaves
 * `parts.<type>` e `params.<key>`, para poder traduzir depois.
 */
export interface ComponentDef {
  type: string;
  domain: Domain;
  category: CategoryId;
  /** Prefixo do rótulo automático: "A" → A1, A2… */
  labelPrefix: string;
  /** O rótulo aponta para outra peça (contato de relé → bobina K1): começa em prefixo+1, sem numerar. */
  referenceLabel?: boolean;
  /** Tamanho do símbolo em unidades de mundo (múltiplos da grade). */
  width: number;
  height: number;
  ports: readonly PortDef[];
  params: readonly ParamDef[];
  /** Palavras extras para a busca da biblioteca. */
  keywords?: string[];
  /** Comportamento no motor de simulação (ausente = peça ainda não simulada). */
  sim?: SimSpec;
  /** Pode ser operada com clique durante a simulação (botões, alavancas, acionamento manual). */
  interactive?: boolean;
  /** Desenho SVG do símbolo, em coordenadas locais (0,0)–(width,height). */
  Symbol: ComponentType<SymbolProps>;
}
