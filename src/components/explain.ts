/**
 * Modo Explique: frases sobre o que a peça está fazendo agora, montadas a partir
 * do estado da simulação. Puro (sem React), para poder testar.
 */
import type { ComponentSimState, SimSnapshot } from "@/engine/core/sim-types";
import type { ComponentInstance } from "@/engine/core/types";
import { t } from "@/i18n";
import type { ComponentDef } from "@/symbols/types";

const n = (v: number, digits = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Frases do "agora" para uma peça. Vazio se não houver nada a dizer. */
export function explainNow(def: ComponentDef, comp: ComponentInstance, snap: SimSnapshot): string[] {
  const st: ComponentSimState = snap.components[comp.id] ?? {};
  const spec = def.sim;
  const out: string[] = [];
  if (!spec) return out;

  if (spec.kind === "valve") {
    const index = Math.round(st.spool ?? spec.restIndex);
    const square = spec.squares[Math.max(0, Math.min(spec.squares.length - 1, index))];
    const flows = square.flows.map(([a, b]) => `${a}→${b}`).join(", ");
    const blocked = square.blocked.join(", ");
    const where = index === spec.restIndex ? t("explain.valveRest") : t("explain.valveShifted");
    out.push(t("explain.valve", { where, flows: flows || "—" }) + (blocked ? ` ${t("explain.valveBlocked", { ports: blocked })}` : ""));
    if (st.spool !== undefined && Math.abs(st.spool - index) > 0.05) out.push(t("explain.valveMoving"));
    if (st.conflict) out.push(t("explain.conflict"));
  } else if (spec.kind === "cylinder") {
    const ext = st.extension ?? 0;
    const v = st.velocity ?? 0;
    const stroke = typeof comp.params.stroke === "number" ? comp.params.stroke : 100;
    const pos = n(ext * stroke, 0);
    if (Math.abs(v) > 0.002) out.push(t(v > 0 ? "explain.advancing" : "explain.retracting", { v: n(Math.abs(v), 2), pos }));
    else if (ext > 0.98) out.push(t("explain.extended"));
    else if (ext < 0.02) out.push(t("explain.retracted"));
    else out.push(t("explain.stoppedMid", { pos }));
  } else if (spec.kind === "elec-switch") {
    out.push(t(st.closed ? "explain.contactClosed" : "explain.contactOpen"));
  } else if (spec.kind === "elec-load") {
    const volts = n(Math.abs(st.pressure ?? 0));
    out.push(t(st.energized ? "explain.loadOn" : "explain.loadOff", { v: volts }));
    if (st.charge !== undefined && st.energized) out.push(t("explain.timerCharge", { p: n((st.charge ?? 0) * 100, 0) }));
    if (st.count !== undefined) out.push(t("explain.count", { n: st.count }));
  } else if (spec.kind === "elec-plc") {
    if (!st.energized || !st.plc) out.push(t("explain.plcOff"));
    else {
      const on = (bits: boolean[], p: string) => bits.flatMap((b, i) => (b ? [`${p}${i}`] : [])).join(", ") || "—";
      out.push(t("explain.plc", { i: on(st.plc.inputs, "I"), q: on(st.plc.outputs, "Q") }));
      if (st.plc.steps.length) out.push(t("explain.plcSteps", { x: st.plc.steps.join(", ") }));
    }
  } else if (spec.kind === "elec-fuse") {
    out.push(t(st.blown ? "explain.fuseOpen" : "explain.fuseOk"));
  } else if (spec.kind === "timer" || spec.kind === "counter") {
    if (st.charge !== undefined) out.push(t("explain.timerCharge", { p: n(st.charge * 100, 0) }));
    if (st.count !== undefined) out.push(t("explain.count", { n: st.count }));
  } else if (spec.kind === "air-motor" || spec.kind === "hyd-motor") {
    out.push(t("explain.motor", { rpm: n(Math.abs(st.rpm ?? 0), 0) }));
  } else if (spec.kind === "suction-cup") {
    out.push(t(st.holding ? "explain.holding" : "explain.notHolding"));
  } else if (spec.kind === "flow-meter" && st.flow !== undefined) {
    out.push(t("explain.flow", { q: n(st.flow) }));
  }
  if (st.pressure !== undefined && !spec.kind.startsWith("elec-") && spec.kind !== "cylinder") {
    out.push(t("explain.pressure", { p: n(st.pressure) }));
  }
  return out;
}

/** Pressão [bar] em cada conector de fluido da peça. */
export function portPressures(def: ComponentDef, comp: ComponentInstance, snap: SimSnapshot): { port: string; bar: number }[] {
  return def.ports
    .filter((p) => p.kind !== "electric")
    .map((p) => ({ port: p.id, bar: snap.ports[`${comp.id}:${p.id}`] }))
    .filter((x): x is { port: string; bar: number } => typeof x.bar === "number");
}
