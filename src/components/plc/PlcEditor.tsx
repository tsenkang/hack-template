"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  checkProgram,
  parseProgram,
  serializeProgram,
  targetKinds,
  type CoilKind,
  type GrafcetStep,
  type GrafcetTransition,
  type PlcProgram,
  type PlcState,
  type Rung,
} from "@/engine/logic/plc";
import { t, tDynamic } from "@/i18n";
import { selectActiveCircuit, useEditor } from "@/store/editor-store";
import { isSimulating, useSim } from "@/store/sim-store";
import { useUi } from "@/store/ui-store";
import { IconButton } from "../IconButton";
import { GrafcetDiagram } from "./GrafcetDiagram";
import { LadderRung } from "./LadderRung";
import { PLC_EXAMPLES } from "./examples";

const COILS: CoilKind[] = ["out", "set", "reset", "ton", "tof", "ctu", "ctr"];
const field = "h-8 rounded-md border border-line bg-app px-2 text-sm outline-none focus:border-accent";

/** CLP sendo editado: o selecionado, ou o primeiro do circuito da aba ativa. */
function usePlc() {
  return useEditor((s) => {
    const circuit = selectActiveCircuit(s);
    const plcs = circuit.components.filter((c) => c.type === "elec.plc");
    return plcs.find((c) => s.selection.includes(c.id)) ?? plcs[0];
  });
}

/** Editor do programa do CLP: ladder (degraus) e GRAFCET, com o estado ao vivo na simulação. */
export function PlcEditor() {
  const open = useUi((s) => s.plcEditor);
  const setOpen = useUi((s) => s.setPlcEditor);
  const ref = useRef<HTMLDialogElement>(null);
  const plc = usePlc();
  const live = useSim((s) => (plc ? s.snapshot?.components[plc.id]?.plc : undefined));
  const [tab, setTab] = useState<"ladder" | "grafcet">("ladder");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const program = parseProgram(plc?.params.program);
  const save = (next: PlcProgram) => {
    if (!plc) return;
    const value = serializeProgram(next);
    useEditor.getState().setParam(plc.id, "program", value);
    if (isSimulating()) useSim.getState().setParam(plc.id, "program", value);
  };
  const issues = checkProgram(program);
  const issueFor = (where: string, index: number) => issues.find((i) => i.where === where && i.index === index);

  return (
    <dialog
      ref={ref}
      onClose={() => setOpen(false)}
      aria-labelledby="plc-title"
      className="m-auto h-[min(48rem,calc(100dvh-2rem))] w-[min(64rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-0 text-fg shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-line p-3">
          <h2 id="plc-title" className="font-semibold">
            {t("plc.title")} {plc ? `· ${plc.label}` : ""}
          </h2>
          <div className="flex gap-1" role="tablist">
            {(["ladder", "grafcet"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={clsx("rounded-md px-3 py-1 text-sm", tab === id ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover")}
              >
                {t(id === "ladder" ? "plc.ladder" : "plc.grafcet")}
              </button>
            ))}
          </div>
          <span className="flex-1" />
          {plc && (
            <select
              aria-label={t("plc.examples")}
              className={field}
              value=""
              onChange={(e) => {
                const ex = PLC_EXAMPLES.find((x) => x.id === e.target.value);
                if (ex && confirm(t("plc.confirmExample"))) save(ex.program);
              }}
            >
              <option value="">{t("plc.examples")}…</option>
              {PLC_EXAMPLES.map((x) => (
                <option key={x.id} value={x.id}>
                  {tDynamic(`plc.example.${x.id}`)}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="text-sm text-muted hover:text-fg" onClick={() => setOpen(false)}>
            {t("dialogs.close")}
          </button>
        </div>

        {!plc ? (
          <p className="p-6 text-muted">{t("plc.noPlc")}</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
            <p className="mb-3 text-xs text-muted">{t("plc.syntaxHelp")}</p>
            {live && (
              <p className="mb-3 font-mono text-xs" data-testid="plc-live">
                I: {live.inputs.map((b) => (b ? "1" : "0")).join("")} · Q: {live.outputs.map((b) => (b ? "1" : "0")).join("")}
                {live.steps.length > 0 && ` · X: ${live.steps.join(", ")}`}
              </p>
            )}
            {tab === "ladder" ? (
              <RungList program={program} save={save} live={live} issueFor={issueFor} />
            ) : (
              <GrafcetEditor program={program} save={save} active={live?.steps} issueFor={issueFor} />
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}

type IssueFor = (where: string, index: number) => { message: string } | undefined;

function move<T>(list: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = list.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

function RungList({
  program,
  save,
  live,
  issueFor,
}: {
  program: PlcProgram;
  save: (p: PlcProgram) => void;
  live?: PlcState;
  issueFor: IssueFor;
}) {
  const setRungs = (rungs: Rung[]) => save({ ...program, rungs });
  const update = (i: number, patch: Partial<Rung>) => setRungs(program.rungs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-3">
      {program.rungs.length === 0 && <p className="text-muted">{t("plc.noRungs")}</p>}
      {program.rungs.map((r, i) => {
        const issue = issueFor("rung", i);
        const usesPreset = r.coil === "ton" || r.coil === "tof" || r.coil === "ctu";
        return (
          <div key={i} className="rounded-lg border border-line p-2" data-testid={`rung-${i}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-8 text-xs font-semibold text-muted">#{i + 1}</span>
              <CommitText
                aria-label={t("plc.condition")}
                className={clsx(field, "min-w-48 flex-1 font-mono", issue?.message === "syntax" && "border-danger")}
                value={r.condition}
                onCommit={(v) => update(i, { condition: v })}
              />
              <span aria-hidden>→</span>
              <select aria-label={t("plc.coil")} className={field} value={r.coil} onChange={(e) => update(i, { coil: e.target.value as CoilKind })}>
                {COILS.map((c) => (
                  <option key={c} value={c}>
                    {tDynamic(`plc.coils.${c}`)}
                  </option>
                ))}
              </select>
              <CommitText
                aria-label={t("plc.target")}
                className={clsx(field, "w-16 font-mono", issue?.message === "target" && "border-danger")}
                value={r.target}
                onCommit={(v) => update(i, { target: v.toUpperCase() })}
              />
              {usesPreset && (
                <CommitText
                  aria-label={t("plc.preset")}
                  className={clsx(field, "w-16")}
                  value={String(r.preset ?? 1)}
                  onCommit={(v) => {
                    const n = Number(v.replace(",", "."));
                    if (Number.isFinite(n) && n >= 0) update(i, { preset: n });
                  }}
                />
              )}
              <IconButton label={t("plc.up")} onClick={() => setRungs(move(program.rungs, i, -1))}>
                <ArrowUp size={14} />
              </IconButton>
              <IconButton label={t("plc.down")} onClick={() => setRungs(move(program.rungs, i, 1))}>
                <ArrowDown size={14} />
              </IconButton>
              <IconButton label={t("dialogs.delete")} onClick={() => setRungs(program.rungs.filter((_, k) => k !== i))}>
                <Trash2 size={14} />
              </IconButton>
            </div>
            {issue && <p className="mt-1 text-xs text-danger">{tDynamic(`plc.issues.${issue.message}`, { kinds: targetKinds(r.coil).join("/") })}</p>}
            <div className="mt-2 overflow-x-auto">
              <LadderRung condition={r.condition} coil={r.coil} target={r.target} preset={usesPreset ? r.preset : undefined} state={live} />
            </div>
          </div>
        );
      })}
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 hover:bg-hover"
        onClick={() => setRungs([...program.rungs, { condition: "I0", coil: "out", target: `Q${Math.min(7, program.rungs.length)}` }])}
      >
        <Plus size={14} /> {t("plc.addRung")}
      </button>
    </div>
  );
}

function GrafcetEditor({
  program,
  save,
  active,
  issueFor,
}: {
  program: PlcProgram;
  save: (p: PlcProgram) => void;
  active?: number[];
  issueFor: IssueFor;
}) {
  const setSteps = (steps: GrafcetStep[]) => save({ ...program, steps });
  const setTransitions = (transitions: GrafcetTransition[]) => save({ ...program, transitions });
  const nums = (v: string) =>
    v
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n < 100);
  const nextN = program.steps.reduce((m, s) => Math.max(m, s.n + 1), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{t("plc.steps")}</h3>
          {issueFor("step", 0) && <p className="mb-1 text-xs text-danger">{t("plc.issues.noInitial")}</p>}
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="w-12 font-medium">{t("plc.step")}</th>
                <th className="w-14 font-medium">{t("plc.initial")}</th>
                <th className="font-medium">{t("plc.actions")}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {program.steps.map((s, i) => (
                <tr key={`${s.n}-${i}`} className="border-t border-line">
                  <td className="py-1 font-semibold">{s.n}</td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${t("plc.initial")} ${s.n}`}
                      checked={!!s.initial}
                      onChange={(e) => setSteps(program.steps.map((x, k) => (k === i ? { ...x, initial: e.target.checked } : x)))}
                    />
                  </td>
                  <td className="py-1">
                    <CommitText
                      aria-label={`${t("plc.actions")} ${s.n}`}
                      className={clsx(field, "w-full font-mono")}
                      value={s.actions}
                      onCommit={(v) => setSteps(program.steps.map((x, k) => (k === i ? { ...x, actions: v.toUpperCase() } : x)))}
                    />
                  </td>
                  <td>
                    <IconButton label={t("dialogs.delete")} onClick={() => setSteps(program.steps.filter((_, k) => k !== i))}>
                      <Trash2 size={14} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 hover:bg-hover"
            onClick={() => setSteps([...program.steps, { n: nextN, initial: program.steps.length === 0, actions: "" }])}
          >
            <Plus size={14} /> {t("plc.addStep")}
          </button>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{t("plc.transitions")}</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="w-16 font-medium">{t("plc.from")}</th>
                <th className="w-16 font-medium">{t("plc.to")}</th>
                <th className="font-medium">{t("plc.condition")}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {program.transitions.map((tr, i) => {
                const issue = issueFor("transition", i);
                const update = (patch: Partial<GrafcetTransition>) =>
                  setTransitions(program.transitions.map((x, k) => (k === i ? { ...x, ...patch } : x)));
                return (
                  <tr key={i} className="border-t border-line">
                    <td className="py-1 pr-1">
                      <CommitText aria-label={t("plc.from")} className={clsx(field, "w-full", issue?.message === "from" && "border-danger")} value={tr.from.join(", ")} onCommit={(v) => update({ from: nums(v) })} />
                    </td>
                    <td className="py-1 pr-1">
                      <CommitText aria-label={t("plc.to")} className={clsx(field, "w-full", issue?.message === "from" && "border-danger")} value={tr.to.join(", ")} onCommit={(v) => update({ to: nums(v) })} />
                    </td>
                    <td className="py-1">
                      <CommitText
                        aria-label={t("plc.condition")}
                        className={clsx(field, "w-full font-mono", issue?.message === "syntax" && "border-danger")}
                        value={tr.condition}
                        onCommit={(v) => update({ condition: v })}
                      />
                    </td>
                    <td>
                      <IconButton label={t("dialogs.delete")} onClick={() => setTransitions(program.transitions.filter((_, k) => k !== i))}>
                        <Trash2 size={14} />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 hover:bg-hover"
            onClick={() => {
              const last = program.steps[program.steps.length - 1]?.n ?? 0;
              setTransitions([...program.transitions, { from: [last], to: [program.steps[0]?.n ?? 0], condition: "I0" }]);
            }}
          >
            <Plus size={14} /> {t("plc.addTransition")}
          </button>
        </section>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-canvas p-2">
        {program.steps.length === 0 ? <p className="p-4 text-muted">{t("plc.noSteps")}</p> : <GrafcetDiagram program={program} active={active} />}
      </div>
    </div>
  );
}

/** Campo que grava ao sair ou com Enter. */
function CommitText({
  value,
  onCommit,
  ...rest
}: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft.trim());
    setDraft(null);
  };
  return (
    <input
      {...rest}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          e.stopPropagation();
          setDraft(null);
        }
      }}
    />
  );
}
