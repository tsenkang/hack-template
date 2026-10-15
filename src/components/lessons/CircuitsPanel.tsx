"use client";

import clsx from "clsx";
import { ArrowLeft, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { tDynamic, t } from "@/i18n";
import { CIRCUITS, getCircuit } from "@/library";
import { compactSequence } from "@/library/scenario";
import type { LibraryArea } from "@/library/types";
import { useLesson } from "@/store/lesson-store";
import { useSim } from "@/store/sim-store";

const AREAS: LibraryArea[] = ["pneumatic", "electropneumatic", "plc", "hydraulic", "electrohydraulic"];

export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function Level({ level }: { level?: number }) {
  if (!level) return null;
  return (
    <span className="shrink-0 text-[10px] tracking-tight text-muted" title={tDynamic(`lessons.level${level}`)} aria-label={tDynamic(`lessons.level${level}`)}>
      {"●".repeat(level)}
      {"○".repeat(3 - level)}
    </span>
  );
}

/** Circuitos prontos: lista por área e, depois de abrir um, o roteiro passo a passo. */
export function CircuitsPanel() {
  const openId = useLesson((s) => s.circuitId);
  const current = openId ? getCircuit(openId) : undefined;
  if (current) return <CircuitGuide id={current.id} />;
  return <CircuitList />;
}

function CircuitList() {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const hits = CIRCUITS.filter((c) => {
      const text = normalize(`${c.title} ${c.summary} ${tDynamic(`lessons.areas.${c.area}`)}`);
      return terms.every((x) => text.includes(x));
    });
    return AREAS.map((a) => ({ area: a, items: hits.filter((c) => c.area === a) })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-3">
        <label className="flex items-center gap-2 rounded-md border border-line bg-app px-2 focus-within:outline-2 focus-within:outline-accent">
          <Search size={14} className="shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("lessons.searchCircuits")}
            aria-label={t("lessons.searchCircuits")}
            className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>
        <p className="mt-2 text-xs text-muted">{t("lessons.circuitsHint", { n: CIRCUITS.length })}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="circuit-list">
        {groups.map((g) => (
          <section key={g.area} className="mb-3">
            <h3 className="px-1 pb-1 text-xs font-semibold text-muted">{tDynamic(`lessons.areas.${g.area}`)}</h3>
            <ul className="space-y-1">
              {g.items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    data-testid={`circuit-${c.id}`}
                    onClick={() => {
                      if (useSim.getState().status === "stopped" || confirm(t("lessons.confirmStop"))) useLesson.getState().openCircuit(c.id);
                    }}
                    className="w-full rounded-md border border-transparent px-2 py-1.5 text-left hover:border-line hover:bg-hover"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm leading-tight font-medium">{c.title}</span>
                      <Level level={c.level} />
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{c.summary}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className="p-2 text-sm text-muted">{t("lessons.noResults")}</p>}
      </div>
    </div>
  );
}

function CircuitGuide({ id }: { id: string }) {
  const c = getCircuit(id)!;
  const [done, setDone] = useState<number[]>([]);
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="circuit-guide">
      <div className="border-b border-line p-3">
        <button type="button" className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-fg" onClick={() => useLesson.getState().close()}>
          <ArrowLeft size={14} aria-hidden /> {t("lessons.backToList")}
        </button>
        <h2 className="text-sm font-semibold leading-tight">{c.title}</h2>
        <p className="mt-1 text-xs text-muted">{c.summary}</p>
      </div>
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {c.steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <button
              type="button"
              aria-pressed={done.includes(i)}
              aria-label={t("lessons.markStep", { n: i + 1 })}
              onClick={() => setDone(done.includes(i) ? done.filter((x) => x !== i) : [...done, i])}
              className={clsx(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                done.includes(i) ? "border-accent bg-accent text-white" : "border-line text-muted",
              )}
            >
              {done.includes(i) ? "✓" : i + 1}
            </button>
            <span className={clsx(done.includes(i) && "text-muted")}>{s}</span>
          </li>
        ))}
        {c.scenario?.expect && (
          <li className="rounded-md bg-accent-soft p-2 text-xs">
            {t("lessons.expectedSequence")}: <span className="font-mono font-semibold">{compactSequence(c.scenario.expect)}</span>
          </li>
        )}
      </ol>
    </div>
  );
}
