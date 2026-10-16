"use client";

import { FlipHorizontal2, RotateCw } from "lucide-react";
import { useState } from "react";
import type { ComponentInstance, ParamValue } from "@/engine/core/types";
import { getLocale, t, tDynamic } from "@/i18n";
import { selectActiveCircuit, useEditor } from "@/store/editor-store";
import { isSimulating, useSim } from "@/store/sim-store";
import { useUi } from "@/store/ui-store";
import { getDef } from "@/symbols/registry";
import type { ParamDef } from "@/symbols/types";
import { explainNow, portPressures } from "./explain";
import { IconButton } from "./IconButton";
import { SymbolPreview } from "./SymbolPreview";

const fieldClass =
  "h-8 w-full rounded-md border border-line bg-app px-2 text-sm outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-accent";

/** Painel da direita: mostra e edita a peça selecionada. */
export function PropertiesPanel() {
  const circuit = useEditor(selectActiveCircuit);
  const selection = useEditor((s) => s.selection);
  const selected = circuit.components.filter((c) => selection.includes(c.id));
  const explainOn = useUi((s) => s.explain);

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-line bg-panel" aria-label={t("properties.title")}>
      <h2 className="border-b border-line p-3 text-sm font-semibold">{t("properties.title")}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
        {selected.length === 0 && (
          <div className="space-y-2 text-muted">
            {explainOn && <p className="font-medium text-accent">{t("explain.pick")}</p>}
            <p>{t("properties.nothingSelected")}</p>
            <p>{t("properties.circuitInfo", { components: circuit.components.length })}</p>
          </div>
        )}
        {selected.length > 1 && <p className="text-muted">{t("properties.multiple", { count: selected.length })}</p>}
        {selected.length === 1 && <ComponentProperties key={selected[0].id} comp={selected[0]} />}
      </div>
    </aside>
  );
}

/** Modo Explique: o que a peça faz, o princípio da categoria e o que está acontecendo agora. */
function ExplainSection({ comp }: { comp: ComponentInstance }) {
  const def = getDef(comp.type);
  const snapshot = useSim((s) => s.snapshot);
  if (!def) return null;
  const now = snapshot ? explainNow(def, comp, snapshot) : [];
  const ports = snapshot ? portPressures(def, comp, snapshot) : [];
  return (
    <section className="space-y-2 rounded-lg border border-accent/40 bg-accent-soft/50 p-3" data-testid="explain" aria-live="polite">
      <h4 className="text-xs font-semibold tracking-wide text-accent uppercase">{t("explain.title")}</h4>
      <p>
        <span className="font-semibold">{t("explain.principle")}: </span>
        {tDynamic(`explainCategory.${def.category}`)}
      </p>
      <div>
        <p className="font-semibold">{t("explain.now")}</p>
        {!snapshot ? (
          <p className="text-muted">{t("explain.startSim")}</p>
        ) : now.length === 0 && ports.length === 0 ? (
          <p className="text-muted">{t("explain.nothing")}</p>
        ) : (
          <ul className="list-disc space-y-0.5 pl-4" data-testid="explain-now">
            {now.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {ports.length > 0 && (
          <p className="mt-1 text-xs text-muted tabular-nums">
            {t("explain.ports")}: {ports.map((p) => `${p.port} = ${p.bar.toLocaleString(getLocale(), { maximumFractionDigits: 1 })} bar`).join(" · ")}
          </p>
        )}
      </div>
    </section>
  );
}

function ComponentProperties({ comp }: { comp: ComponentInstance }) {
  const def = getDef(comp.type);
  const explain = useUi((s) => s.explain);
  if (!def) return null;
  const s = useEditor.getState;

  return (
    <div className="space-y-4">
      <header className="flex gap-3">
        <SymbolPreview def={def} className="h-14 w-20 shrink-0 rounded-md border border-line bg-canvas p-1" />
        <div>
          <h3 className="font-semibold leading-tight">{tDynamic(`parts.${comp.type}.name`)}</h3>
          <p className="mt-1 text-xs text-muted">{tDynamic(`parts.${comp.type}.description`)}</p>
        </div>
      </header>

      {explain && <ExplainSection comp={comp} />}

      <Field id="prop-label" label={t("properties.label")} help={t("properties.labelHelp")}>
        <CommitInput
          id="prop-label"
          className={fieldClass}
          value={comp.label}
          onCommit={(v) => s().setLabel(comp.id, v.trim())}
        />
      </Field>

      <section>
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{t("properties.transform")}</h4>
        <div className="flex gap-1">
          <IconButton label={t("canvas.rotate")} onClick={() => s().rotateSelection()} className="border border-line">
            <RotateCw size={16} />
            <span className="ml-1 text-xs">{comp.rotation}°</span>
          </IconButton>
          <IconButton
            label={t("canvas.mirror")}
            active={comp.mirrored}
            onClick={() => s().mirrorSelection()}
            className="border border-line"
          >
            <FlipHorizontal2 size={16} />
          </IconButton>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{t("properties.parameters")}</h4>
        {def.params.length === 0 && <p className="text-muted">{t("properties.noParams")}</p>}
        <div className="space-y-3">
          {def.params.map((p) => (
            <ParamField
              key={p.key}
              param={p}
              value={comp.params[p.key] ?? p.default}
              onChange={(v) => {
                s().setParam(comp.id, p.key, v);
                // Durante a simulação o valor novo vale na hora (ex.: girar o regulador).
                if (isSimulating()) useSim.getState().setParam(comp.id, p.key, v);
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ id, label, help, children }: { id: string; label: string; help: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium">
        {label}
      </label>
      {children}
      <p id={`${id}-help`} className="mt-1 text-xs text-muted">
        {help}
      </p>
    </div>
  );
}

function ParamField({ param, value, onChange }: { param: ParamDef; value: ParamValue; onChange: (v: ParamValue) => void }) {
  const id = `param-${param.key}`;
  const label = tDynamic(`params.${param.key}.label`);
  const help = tDynamic(`params.${param.key}.help`);

  if (param.type === "boolean") {
    return (
      <Field id={id} label={label} help={help}>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
      </Field>
    );
  }
  if (param.type === "select") {
    return (
      <Field id={id} label={label} help={help}>
        <select id={id} className={fieldClass} value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {param.options.map((o) => (
            <option key={o} value={o}>
              {tDynamic(`options.${o}`)}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  if (param.type === "program") {
    return (
      <Field id={id} label={label} help={help}>
        <button
          id={id}
          type="button"
          className="h-8 w-full rounded-md border border-line bg-app px-2 text-sm font-medium hover:bg-hover"
          onClick={() => useUi.getState().setPlcEditor(true)}
        >
          {t("plc.edit")}
        </button>
      </Field>
    );
  }
  if (param.type === "text") {
    return (
      <Field id={id} label={label} help={help}>
        <CommitInput id={id} className={fieldClass} value={String(value)} onCommit={(v) => onChange(v.trim())} />
      </Field>
    );
  }
  return (
    <Field id={id} label={param.unit ? `${label} (${param.unit})` : label} help={help}>
      <CommitInput
        id={id}
        type="number"
        inputMode="decimal"
        min={param.min}
        max={param.max}
        step={param.step ?? 1}
        aria-describedby={`${id}-help`}
        className={fieldClass}
        value={String(value)}
        onCommit={(raw) => {
          const n = Number(raw.replace(",", "."));
          if (Number.isFinite(n)) onChange(Math.min(param.max, Math.max(param.min, n)));
        }}
      />
    </Field>
  );
}

/**
 * Campo de texto que só grava ao sair do campo ou apertar Enter.
 * Assim, digitar "100" vira 1 passo de desfazer, e não 3.
 */
function CommitInput({
  value,
  onCommit,
  ...rest
}: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
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
        if (e.key === "Escape") setDraft(null);
      }}
    />
  );
}
