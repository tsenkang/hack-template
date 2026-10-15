"use client";

import clsx from "clsx";
import { ArrowLeft, CheckCircle2, Download, FileUp, Plus, Trash2, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { createId } from "@/engine/core/ids";
import type { Project } from "@/engine/core/types";
import { t } from "@/i18n";
import { exportExercise, parseExercise, type CustomExercise } from "@/persistence/exercise-file";
import { useEditor } from "@/store/editor-store";
import { builtInExercises, fromCustom, useLesson, type LessonExercise } from "@/store/lesson-store";
import { actionLog, sequenceFromHistory, useSim } from "@/store/sim-store";
import { toast } from "@/store/toast-store";
import { useUi } from "@/store/ui-store";
import { compactSequence } from "@/library/scenario";
import { getDef } from "@/symbols/registry";
import { IconButton } from "../IconButton";
import { Level } from "./CircuitsPanel";

/** Exercícios: lista, enunciado com conferência automática e (modo Professor) criação de exercícios. */
export function ExercisesPanel() {
  const exercise = useLesson((s) => s.exercise);
  const [creating, setCreating] = useState(false);
  if (exercise) return <ExerciseView ex={exercise} />;
  if (creating) return <CreateExercise onDone={() => setCreating(false)} />;
  return <ExerciseList onCreate={() => setCreating(true)} />;
}

function ExerciseList({ onCreate }: { onCreate: () => void }) {
  const role = useUi((s) => s.role);
  const custom = useLesson((s) => s.custom);
  const fileRef = useRef<HTMLInputElement>(null);
  const open = (ex: LessonExercise) => {
    if (useSim.getState().status === "stopped" || confirm(t("lessons.confirmStop"))) useLesson.getState().openExercise(ex);
  };
  const row = (ex: LessonExercise, extra?: React.ReactNode) => (
    <li key={ex.id} className="flex items-start gap-1">
      <button
        type="button"
        data-testid={`exercise-${ex.id}`}
        onClick={() => open(ex)}
        className="flex-1 rounded-md border border-transparent px-2 py-1.5 text-left hover:border-line hover:bg-hover"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm leading-tight font-medium">{ex.title}</span>
          <Level level={ex.level} />
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{ex.statement}</span>
      </button>
      {extra}
    </li>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-3 text-xs text-muted">
        <p>{t(role === "teacher" ? "lessons.exercisesTeacher" : "lessons.exercisesStudent")}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            data-testid="exercise-import"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              let parsed: CustomExercise | null = null;
              try {
                parsed = parseExercise(JSON.parse(await file.text()));
              } catch {
                parsed = null;
              }
              if (!parsed) toast(t("lessons.importFailed"), "error");
              else {
                useLesson.getState().addCustom(parsed);
                toast(t("lessons.imported", { title: parsed.title }));
              }
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-fg hover:bg-hover">
            <FileUp size={14} aria-hidden /> {t("lessons.importExercise")}
          </button>
          {role === "teacher" && (
            <button type="button" onClick={onCreate} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-fg hover:bg-hover" data-testid="create-exercise">
              <Plus size={14} aria-hidden /> {t("lessons.createExercise")}
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {custom.length > 0 && (
          <section className="mb-3">
            <h3 className="px-1 pb-1 text-xs font-semibold text-muted">{t("lessons.customExercises")}</h3>
            <ul className="space-y-1">
              {custom.map((c) =>
                row(
                  fromCustom(c),
                  <div className="flex flex-col">
                    {role === "teacher" && (
                      <IconButton label={t("lessons.exportExercise")} onClick={() => exportExercise(c, confirm(t("lessons.exportWithSolution")))}>
                        <Download size={14} />
                      </IconButton>
                    )}
                    <IconButton label={t("dialogs.delete")} onClick={() => confirm(t("lessons.confirmDelete", { title: c.title })) && useLesson.getState().removeCustom(c.id)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>,
                ),
              )}
            </ul>
          </section>
        )}
        <section>
          <h3 className="px-1 pb-1 text-xs font-semibold text-muted">{t("lessons.builtInExercises")}</h3>
          <ul className="space-y-1" data-testid="exercise-list">
            {builtInExercises().map((ex) => row(ex))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function ExerciseView({ ex }: { ex: LessonExercise }) {
  const role = useUi((s) => s.role);
  const { result, checking } = useLesson();
  const [hints, setHints] = useState(0);
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="exercise-view">
      <div className="border-b border-line p-3">
        <button type="button" className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-fg" onClick={() => useLesson.getState().close()}>
          <ArrowLeft size={14} aria-hidden /> {t("lessons.backToExercises")}
        </button>
        <h2 className="text-sm font-semibold leading-tight">{ex.title}</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        <p>{ex.statement}</p>
        {ex.requirements.length > 0 && (
          <p className="text-xs text-muted">
            {t("lessons.requirements")}: <span className="font-mono font-semibold text-fg">{ex.requirements.join(", ")}</span>
          </p>
        )}
        <p className="text-xs text-muted">
          {t("lessons.expectedSequence")}: <span className="font-mono font-semibold text-fg">{compactSequence(ex.scenario.expect)}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={checking}
            onClick={() => useLesson.getState().check()}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            data-testid="check-exercise"
          >
            {checking ? t("lessons.checking") : t("lessons.check")}
          </button>
          {ex.hints.length > hints && (
            <button type="button" className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-hover" onClick={() => setHints(hints + 1)}>
              {t("lessons.hint")} ({hints + 1}/{ex.hints.length})
            </button>
          )}
          {role === "teacher" && ex.solution && (
            <button
              type="button"
              className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-hover"
              onClick={() => confirm(t("lessons.confirmSolution")) && useLesson.getState().showSolution()}
              data-testid="show-solution"
            >
              {t("lessons.solution")}
            </button>
          )}
        </div>
        {result && (
          <div
            role="status"
            data-testid="check-result"
            className={clsx("rounded-md border p-2 text-sm", result.ok ? "border-green-600/40 bg-green-600/10" : "border-danger/40 bg-danger/10")}
          >
            <p className="flex items-center gap-1.5 font-semibold">
              {result.ok ? <CheckCircle2 size={16} className="text-green-600" aria-hidden /> : <XCircle size={16} className="text-danger" aria-hidden />}
              {result.ok ? t("lessons.correct") : t("lessons.wrong")}
            </p>
            {result.missing.length > 0 && <p className="mt-1">{t("lessons.missingLabels", { labels: result.missing.join(", ") })}</p>}
            {!result.ok && (
              <p className="mt-1 text-xs">
                {t("lessons.got")}: <span className="font-mono">{result.sequence.join(" ") || t("lessons.noMovement")}</span>
              </p>
            )}
          </div>
        )}
        {hints > 0 && (
          <ul className="list-disc space-y-1 pl-4 text-xs">
            {ex.hints.slice(0, hints).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">{t("lessons.howChecked")}</p>
      </div>
    </div>
  );
}

/** Professor: grava o roteiro da última simulação e salva o projeto atual como exercício. */
function CreateExercise({ onDone }: { onDone: () => void }) {
  const project = useEditor((s) => s.project);
  const [title, setTitle] = useState(project.name);
  const [statement, setStatement] = useState("");
  const [hints, setHints] = useState("");
  const labels = new Map(project.circuits.flatMap((c) => c.components.map((k) => [k.id, k.label] as const)));
  const actions = actionLog.filter((a) => labels.get(a.id));
  const sequence = sequenceFromHistory(labels);
  const lastT = Math.max(0, ...actions.map((a) => a.t), 0);
  const ready = sequence.length > 0 && title.trim() && statement.trim();

  const save = () => {
    const keepKinds = new Set(["cylinder", "air-source", "elec-supply", "hyd-pump", "hyd-tank", "hyd-relief"]);
    const start: Project = JSON.parse(JSON.stringify(project));
    for (const c of start.circuits) {
      c.components = c.components.filter((k) => keepKinds.has(getDef(k.type)?.sim?.kind ?? ""));
      const ids = new Set(c.components.map((k) => k.id));
      c.connections = c.connections.filter((w) => ids.has(w.from.componentId) && ids.has(w.to.componentId));
    }
    const ex: CustomExercise = {
      id: createId("ex"),
      title: title.trim(),
      statement: statement.trim(),
      requirements: [...new Set(actions.map((a) => labels.get(a.id)!))],
      hints: hints.split("\n").map((h) => h.trim()).filter(Boolean),
      scenario: {
        actions: actions.map((a) => ({ t: Math.round(a.t * 1000) / 1000, target: labels.get(a.id)!, side: a.side, active: a.active })),
        duration: Math.ceil(Math.max(lastT, useSim.getState().snapshot?.time ?? lastT) + 1),
        expect: sequence.join(" "),
      },
      start,
      solution: JSON.parse(JSON.stringify(project)),
    };
    useLesson.getState().addCustom(ex);
    toast(t("lessons.created", { title: ex.title }));
    onDone();
  };

  const field = "w-full rounded-md border border-line bg-app px-2 py-1 text-sm outline-none focus:border-accent";
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="create-exercise-form">
      <div className="border-b border-line p-3">
        <button type="button" className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-fg" onClick={onDone}>
          <ArrowLeft size={14} aria-hidden /> {t("lessons.backToExercises")}
        </button>
        <h2 className="text-sm font-semibold">{t("lessons.createExercise")}</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        <p className="text-xs text-muted">{t("lessons.createHelp")}</p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t("lessons.fieldTitle")}</span>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t("lessons.fieldStatement")}</span>
          <textarea className={field} rows={4} value={statement} onChange={(e) => setStatement(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t("lessons.fieldHints")}</span>
          <textarea className={field} rows={3} value={hints} onChange={(e) => setHints(e.target.value)} />
        </label>
        <div className="rounded-md bg-accent-soft p-2 text-xs">
          <p>
            {t("lessons.recordedActions")}: <span className="font-semibold">{actions.length}</span>
          </p>
          <p>
            {t("lessons.recordedSequence")}: <span className="font-mono font-semibold">{sequence.join(" ") || "—"}</span>
          </p>
        </div>
        <button
          type="button"
          disabled={!ready}
          onClick={save}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {t("lessons.saveExercise")}
        </button>
      </div>
    </div>
  );
}
