"use client";

/**
 * Paleta de comandos (Ctrl+K): busca única para ações, peças, circuitos prontos e exercícios.
 * Setas escolhem, Enter executa, Esc fecha.
 */
import clsx from "clsx";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fitAll, insertAtCenter } from "@/editor/actions";
import { t, tDynamic } from "@/i18n";
import { CIRCUITS } from "@/library";
import { useEditor } from "@/store/editor-store";
import { builtInExercises, fromCustom, useLesson } from "@/store/lesson-store";
import { useSim } from "@/store/sim-store";
import { useUi } from "@/store/ui-store";
import { COMPONENT_DEFS } from "@/symbols/registry";
import { setHintsEnabled } from "@/editor/CanvasHint";
import { normalize } from "./lessons/CircuitsPanel";
import { exportImage, exportJson, exportPdf, newProject, saveNow, startSimulation } from "./project-actions";

type Group = "action" | "part" | "circuit" | "exercise";

interface Command {
  id: string;
  group: Group;
  label: string;
  hint?: string;
  run(): void;
}

const MAX = 60;

function buildCommands(): Command[] {
  const ui = useUi.getState;
  const a = (id: string, run: () => void, hint?: string): Command => ({ id: `a:${id}`, group: "action", label: tDynamic(`palette.actions.${id}`), hint, run });
  const actions: Command[] = [
    a("play", () => (useSim.getState().status === "running" ? useSim.getState().pause() : startSimulation()), "F5"),
    a("stop", () => useSim.getState().stop(), "Esc"),
    a("save", saveNow, "Ctrl+S"),
    a("open", () => ui().setOpenDialog(true), "Ctrl+O"),
    a("new", newProject),
    a("undo", () => useEditor.getState().undo(), "Ctrl+Z"),
    a("redo", () => useEditor.getState().redo(), "Ctrl+Y"),
    a("exportJson", exportJson),
    a("exportSvg", () => exportImage("svg")),
    a("exportPng", () => exportImage("png")),
    a("exportPdf", exportPdf),
    a("fit", fitAll, "0"),
    a("addTab", () => useEditor.getState().addCircuit()),
    a("explain", () => ui().toggleExplain()),
    a("role", () => ui().setRole(ui().role === "teacher" ? "student" : "teacher")),
    a("plc", () => ui().setPlcEditor(true)),
    a("theme", () => ui().toggleTheme()),
    a("hints", () => setHintsEnabled(true)),
    a("charts", () => ui().setBottomTab("charts")),
    a("phases", () => ui().setBottomTab("phases")),
    a("warnings", () => ui().setBottomTab("warnings")),
    a("circuits", () => ui().setSideTab("circuits")),
    a("exercises", () => ui().setSideTab("exercises")),
  ];
  const parts: Command[] = COMPONENT_DEFS.map((d) => ({
    id: `p:${d.type}`,
    group: "part",
    label: tDynamic(`parts.${d.type}.name`),
    hint: tDynamic(`categories.${d.category}`),
    run: () => insertAtCenter(d.type),
  }));
  const circuits: Command[] = CIRCUITS.map((c) => ({
    id: `c:${c.id}`,
    group: "circuit",
    label: c.title,
    hint: tDynamic(`lessons.areas.${c.area}`),
    run: () => {
      ui().setSideTab("circuits");
      useLesson.getState().openCircuit(c.id);
    },
  }));
  const exercises: Command[] = [...useLesson.getState().custom.map(fromCustom), ...builtInExercises()].map((ex) => ({
    id: `e:${ex.id}`,
    group: "exercise",
    label: ex.title,
    run: () => {
      ui().setSideTab("exercises");
      useLesson.getState().openExercise(ex);
    },
  }));
  return [...actions, ...parts, ...circuits, ...exercises];
}

export function CommandPalette() {
  const open = useUi((s) => s.palette);
  const ref = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQuery("");
      setIndex(0);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const commands = useMemo(() => (open ? buildCommands().map((c) => ({ c, text: normalize(`${c.label} ${c.hint ?? ""}`) })) : []), [open]);
  const results = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return commands.filter(({ text }) => terms.every((x) => text.includes(x))).map(({ c }) => c).slice(0, MAX);
  }, [commands, query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    useUi.getState().setPalette(false);
    // fecha primeiro, para diálogos abertos pelo comando não ficarem atrás da paleta
    setTimeout(() => c.run(), 0);
  };

  return (
    <dialog
      ref={ref}
      onClose={() => useUi.getState().setPalette(false)}
      aria-label={t("palette.open")}
      className="mx-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-0 text-fg shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center gap-2 border-b border-line px-3">
        <Search size={16} className="text-muted" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(results[index]);
            }
          }}
          placeholder={t("palette.placeholder")}
          aria-label={t("palette.placeholder")}
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-activedescendant={results[index] ? `palette-${index}` : undefined}
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          data-testid="palette-input"
        />
      </div>
      <ul ref={listRef} id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
        {results.length === 0 && <li className="px-4 py-3 text-sm text-muted">{t("palette.empty")}</li>}
        {results.map((c, i) => {
          const header = c.group !== results[i - 1]?.group;
          return (
            <li key={c.id} role="presentation">
              {header && <div className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{tDynamic(`palette.groups.${c.group}`)}</div>}
              <div
                id={`palette-${i}`}
                role="option"
                aria-selected={i === index}
                data-index={i}
                onPointerMove={() => setIndex(i)}
                onClick={() => run(c)}
                className={clsx("mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-1.5 text-sm", i === index && "bg-accent-soft text-accent")}
              >
                <span className="truncate">{c.label}</span>
                {c.hint && <span className="shrink-0 truncate text-xs text-muted">{c.hint}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
