/**
 * Tradução simples: `t("toolbar.save")` ou `t("library.empty", { query })`.
 * Idiomas: pt-BR (base), en e es. Um idioma novo é um arquivo com as mesmas chaves, registrado em LOCALES.
 */
import { en } from "./en";
import { es } from "./es";
import { ptBR, type Dictionary } from "./pt-BR";

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;

/** Todas as chaves válidas, ex.: "toolbar.save" | "parts.pneu.silencer.name" | … */
type Paths<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T & string];

export type I18nKey = Paths<Dictionary>;

const LOCALES: Record<string, Dictionary> = { "pt-BR": ptBR, en, es };

export type Locale = "pt-BR" | "en" | "es";
/** Nome de cada idioma, escrito no próprio idioma (para o seletor). */
export const LOCALE_NAMES: Record<Locale, string> = { "pt-BR": "Português", en: "English", es: "Español" };
let current: Dictionary = ptBR;
let currentLocale = "pt-BR";

/** Idioma atual (para datas e números, ex.: `n.toLocaleString(getLocale())`). */
export function getLocale() {
  return currentLocale;
}

/** Textos já encontrados (sem variáveis): a busca no dicionário roda uma vez por chave. */
let cache = new Map<string, string>();

export function setLocale(locale: string) {
  currentLocale = locale in LOCALES ? locale : "pt-BR";
  current = LOCALES[currentLocale];
  cache = new Map();
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
  let text = cache.get(key);
  if (text === undefined) {
    text = lookup(current, key) ?? lookup(ptBR, key) ?? key;
    cache.set(key, text);
  }
  return vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : text;
}

/** Versão para chaves montadas em tempo de execução (ex.: nome de peça a partir do tipo). */
export function tDynamic(key: string, vars?: Record<string, string | number>): string {
  return t(key as I18nKey, vars);
}
