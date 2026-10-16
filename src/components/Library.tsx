"use client";

import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { DND_MIME } from "@/editor/Canvas";
import { insertAtCenter } from "@/editor/actions";
import { t, tDynamic } from "@/i18n";
import { CATEGORIES } from "@/symbols/categories";
import { COMPONENT_DEFS } from "@/symbols/registry";
import type { ComponentDef } from "@/symbols/types";
import { SymbolPreview } from "./SymbolPreview";

/** Texto em minúsculas e sem acentos, para a busca achar "valvula" e "válvula". */
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function searchText(def: ComponentDef) {
  return normalize(
    [tDynamic(`parts.${def.type}.name`), tDynamic(`categories.${def.category}`), ...(def.keywords ?? [])].join(" "),
  );
}

type Area = "all" | "pneumatic" | "hydraulic" | "electric";
const AREAS: Area[] = ["all", "pneumatic", "hydraulic", "electric"];

/** Biblioteca de peças: busca, categorias e itens arrastáveis. */
export function Library() {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<Area>("all");
  const index = useMemo(() => COMPONENT_DEFS.map((def) => ({ def, text: searchText(def) })), []);

  const groups = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const hits = index.filter(({ text }) => terms.every((term) => text.includes(term))).map(({ def }) => def);
    return CATEGORIES.filter((cat) => area === "all" || cat.domain === area)
      .map((cat) => ({ cat, defs: hits.filter((d) => d.category === cat.id) }))
      .filter((g) => g.defs.length > 0);
  }, [index, query, area]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-3">
        <label className="flex items-center gap-2 rounded-md border border-line bg-app px-2 focus-within:outline-2 focus-within:outline-accent">
          <Search size={14} className="shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("library.search")}
            aria-label={t("library.search")}
            className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>
        {/* Filtro por área: em vez de ~150 peças de uma vez, só as da matéria da aula. */}
        <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={t("library.areaFilter")}>
          {AREAS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={area === a}
              onClick={() => setArea(a)}
              data-testid={`area-${a}`}
              className={
                area === a
                  ? "rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-panel pointer-coarse:py-2"
                  : "rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:bg-hover hover:text-fg pointer-coarse:py-2"
              }
            >
              {t(`library.areas.${a}`)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t("library.hint")}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groups.length === 0 && <p className="p-2 text-sm text-muted">{t("library.empty", { query })}</p>}
        {groups.map(({ cat, defs }) => (
          <details key={cat.id} open className="group mb-1">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded px-1 py-1.5 text-xs font-semibold text-muted hover:bg-hover">
              <ChevronRight size={14} className="transition-transform group-open:rotate-90" aria-hidden />
              {tDynamic(`categories.${cat.id}`)}
            </summary>
            <ul className="grid grid-cols-2 gap-1 pt-1">
              {defs.map((def) => (
                <li key={def.type}>
                  <LibraryItem def={def} />
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}

function LibraryItem({ def }: { def: ComponentDef }) {
  const name = tDynamic(`parts.${def.type}.name`);
  return (
    <button
      type="button"
      draggable
      data-testid={`library-item-${def.type}`}
      title={tDynamic(`parts.${def.type}.description`)}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_MIME, def.type);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDoubleClick={() => insertAtCenter(def.type)}
      onKeyDown={(e) => {
        if (e.key === "Enter") insertAtCenter(def.type);
      }}
      className="flex h-full w-full cursor-grab flex-col items-center gap-1 rounded-md border border-transparent p-1.5 text-center hover:border-line hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing"
    >
      <SymbolPreview def={def} className="h-12 w-full" />
      <span className="text-[11px] leading-tight">{name}</span>
    </button>
  );
}
