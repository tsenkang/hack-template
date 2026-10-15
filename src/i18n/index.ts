/**
 * Tradução simples: `t("toolbar.save")` ou `t("library.empty", { query })`.
 * O idioma atual é pt-BR; outros idiomas entram em LOCALES quando forem traduzidos.
 */
import { ptBR, type Dictionary } from "./pt-BR";

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;

/** Todas as chaves válidas, ex.: "toolbar.save" | "parts.pneu.silencer.name" | … */
type Paths<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T & string];

export type I18nKey = Paths<Dictionary>;

const LOCALES: Record<string, Dictionary> = { "pt-BR": ptBR };
let current: Dictionary = ptBR;

export function setLocale(locale: string) {
  current = LOCALES[locale] ?? ptBR;
}

function lookup(dict: unknown, path: string): string | undefined {
  // As chaves de peças contêm pontos ("pneu.source.air"), então tentamos o
  // maior prefixo existente em cada nível em vez de dividir cegamente por ".".
  if (typeof dict === "string") return path === "" ? dict : undefined;
  if (typeof dict !== "object" || dict === null) return undefined;
  const parts = path.split(".");
  for (let i = parts.length; i > 0; i--) {
    const head = parts.slice(0, i).join(".");
    if (head in dict) {
      const found = lookup((dict as Record<string, unknown>)[head], parts.slice(i).join("."));
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Traduz uma chave, trocando `{nome}` pelos valores de `vars`. */
export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  const text = lookup(current, key) ?? lookup(ptBR, key) ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : text;
}

/** Versão para chaves montadas em tempo de execução (ex.: nome de peça a partir do tipo). */
export function tDynamic(key: string, vars?: Record<string, string | number>): string {
  return t(key as I18nKey, vars);
}
