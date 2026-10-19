"use client";

import clsx from "clsx";
import { CheckCircle2, KeyRound, Loader2, Sparkles, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import type { AssistantError } from "@/assistant/agent";
import { ASSISTANT_LEVELS, type AssistantLevel } from "@/assistant/prompt";
import { getLocale, t, tDynamic } from "@/i18n";
import { saveProject } from "@/persistence/storage";
import { useAssistant } from "@/store/assistant-store";
import { useEditor } from "@/store/editor-store";
import { useLesson } from "@/store/lesson-store";
import { useSim } from "@/store/sim-store";
import { compactSequence } from "@/library/scenario";
import { diagnosticMessage } from "../diagnostics";

const EXAMPLES: Record<AssistantLevel, string[]> = {
  basic: ["assistant.examples.basic1", "assistant.examples.basic2"],
  intermediate: ["assistant.examples.intermediate1", "assistant.examples.intermediate2"],
  advanced: ["assistant.examples.advanced1", "assistant.examples.advanced2"],
};

/**
 * Assistente: a pessoa escolhe o nível, descreve o circuito e o Claude monta.
 * O FluxoLab confere (detector de erros + simulação) e abre o resultado no desenho.
 */
export function AssistantPanel() {
  const { apiKey, level, description, status, result, error } = useAssistant();
  const store = useAssistant.getState;
  const abort = useRef<AbortController | null>(null);
  const running = status !== null;

  const run = async () => {
    const text = description.trim();
    if (!text || !apiKey || running) return;
    const controller = new AbortController();
    abort.current = controller;
    store().set({ status: { phase: "thinking" }, result: null, error: null });
    try {
      const { runAssistant } = await import("@/assistant/agent");
      const res = await runAssistant({
        apiKey,
        description: text,
        level,
        locale: getLocale(),
        describe: diagnosticMessage,
        onStatus: (s) => store().set({ status: s }),
        signal: controller.signal,
      });
      if (res.report) {
        useSim.getState().stop();
        await saveProject(useEditor.getState().project).catch(() => undefined);
        useLesson.getState().close();
        useEditor.getState().loadProject(res.report.project);
      }
      store().set({ result: res, status: null });
    } catch (err) {
      const e = err as AssistantError;
      store().set({ error: { kind: e.kind ?? "other", detail: e.message }, status: null });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="assistant-panel">
      <div className="space-y-3 border-b border-line p-3">
        <p className="text-xs text-muted">{t("assistant.intro")}</p>
        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-muted">{t("assistant.levelLabel")}</legend>
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label={t("assistant.levelLabel")}>
            {ASSISTANT_LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={level === l}
                disabled={running}
                onClick={() => store().setLevel(l)}
                data-testid={`assistant-level-${l}`}
                className={clsx(
                  "rounded-md border px-1 py-1.5 text-xs font-medium pointer-coarse:py-2.5",
                  level === l ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:bg-hover hover:text-fg",
                )}
              >
                {tDynamic(`assistant.levels.${l}`)}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">{tDynamic(`assistant.levelHelp.${level}`)}</p>
        </fieldset>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {!apiKey ? (
          <KeyForm />
        ) : (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">{t("assistant.describeLabel")}</span>
              <textarea
                value={description}
                onChange={(e) => store().setDescription(e.target.value)}
                rows={4}
                disabled={running}
                placeholder={t("assistant.placeholder")}
                className="w-full rounded-md border border-line bg-app px-2 py-1.5 text-sm outline-none focus:border-accent"
                data-testid="assistant-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run();
                }}
              />
            </label>
            <div className="flex flex-wrap gap-1">
              {EXAMPLES[level].map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={running}
                  onClick={() => store().setDescription(tDynamic(k))}
                  className="rounded-full border border-line px-2 py-0.5 text-left text-xs text-muted hover:bg-hover hover:text-fg"
                >
                  {tDynamic(k)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={run}
                disabled={running || !description.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-panel hover:opacity-90 disabled:opacity-50"
                data-testid="assistant-run"
              >
                <Sparkles size={15} aria-hidden /> {t("assistant.run")}
              </button>
              {running && (
                <button type="button" className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-hover" onClick={() => abort.current?.abort()}>
                  {t("dialogs.cancel")}
                </button>
              )}
            </div>

            {status && (
              <p className="flex items-center gap-2 text-xs text-muted" role="status" data-testid="assistant-status">
                <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />
                {status.phase === "thinking" ? t("assistant.thinking") : t("assistant.checking", { n: status.attempt })}
              </p>
            )}
            {error && (
              <div className="rounded-md border border-danger/40 bg-danger/10 p-2 text-xs" role="alert" data-testid="assistant-error">
                <p className="font-semibold">{tDynamic(`assistant.errors.${error.kind}`)}</p>
                {error.kind === "other" && error.detail && <p className="mt-1 text-muted">{error.detail}</p>}
                {error.kind === "auth" && (
                  <button type="button" className="mt-1 text-accent hover:underline" onClick={() => store().setApiKey("")}>
                    {t("assistant.changeKey")}
                  </button>
                )}
              </div>
            )}
            {result && <ResultView />}
            <p className="text-xs text-muted">
              {t("assistant.keySaved")}{" "}
              <button type="button" className="text-accent hover:underline" onClick={() => store().setApiKey("")} disabled={running}>
                {t("assistant.changeKey")}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ResultView() {
  const result = useAssistant((s) => s.result)!;
  const r = result.report;
  const ok = r?.ok ?? false;
  return (
    <div className="space-y-2" data-testid="assistant-result">
      <div className={clsx("rounded-md border p-2", ok ? "border-green-600/40 bg-green-600/10" : "border-amber-600/40 bg-amber-500/10")}>
        <p className="flex items-center gap-1.5 font-semibold">
          {ok ? <CheckCircle2 size={16} className="text-green-600" aria-hidden /> : <XCircle size={16} className="text-amber-600" aria-hidden />}
          {ok ? t("assistant.okTitle") : t("assistant.partialTitle")}
        </p>
        {r?.test && (
          <p className="mt-1 text-xs">
            {t("lessons.expectedSequence")}: <span className="font-mono font-semibold">{compactSequence(r.test.expect)}</span>
            {" · "}
            {t("assistant.simulated")}: <span className="font-mono">{compactSequence(r.test.sequence.join(" ")) || "—"}</span>
          </p>
        )}
        {!ok && r && (r.structural.length > 0 || r.diagnostics.length > 0) && (
          <p className="mt-1 text-xs text-muted">{t("assistant.seeWarnings")}</p>
        )}
      </div>
      {result.message && <p className="whitespace-pre-line">{result.message}</p>}
      {result.steps.length > 0 && (
        <ol className="list-decimal space-y-1 pl-5">
          {result.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted">{t("assistant.savedPrevious")}</p>
    </div>
  );
}

function KeyForm() {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.trim()) useAssistant.getState().setApiKey(draft.trim());
      }}
      data-testid="assistant-key-form"
    >
      <p className="flex items-center gap-1.5 font-semibold">
        <KeyRound size={15} className="text-accent" aria-hidden /> {t("assistant.keyTitle")}
      </p>
      <p className="text-xs text-muted">{t("assistant.keyHelp")}</p>
      <label className="block">
        <span className="sr-only">{t("assistant.keyLabel")}</span>
        <input
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-ant-…"
          className="w-full rounded-md border border-line bg-app px-2 py-1.5 font-mono text-sm outline-none focus:border-accent"
          data-testid="assistant-key"
        />
      </label>
      <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-panel hover:opacity-90 disabled:opacity-50" disabled={!draft.trim()}>
        {t("assistant.saveKey")}
      </button>
      <p className="text-xs text-muted">
        {t("assistant.keyWhere")}{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-accent hover:underline">
          console.anthropic.com
        </a>
      </p>
    </form>
  );
}
