/** Bobinas (relé, contator, solenoide, temporizadores, contador) e sinalização. */
import type { ElectricSpec } from "@/engine/core/sim-types";
import type { ComponentDef, ParamDef, SymbolProps } from "../types";
import { CoilBox, ELEC_H, ELEC_W } from "./draw";

const COIL_TERMINALS = [
  { id: "A1", x: 20, y: 0, kind: "electric" },
  { id: "A2", x: 20, y: ELEC_H, kind: "electric" },
] as const;

const VOLTAGE: ParamDef = { key: "voltage", type: "number", unit: "V", default: 24, min: 1, max: 440 };
const DELAY: ParamDef = { key: "delay", type: "number", unit: "s", default: 3, min: 0.01, max: 3600, step: 0.1 };

type Load = Extract<ElectricSpec, { kind: "elec-load" }>["load"];

function makeCoil(o: {
  type: string;
  load: Load;
  labelPrefix: string;
  params?: ParamDef[];
  keywords: string[];
  /** Desenho extra ao lado/dentro do retângulo (temporizador, contador…). */
  extra?: (props: SymbolProps) => React.ReactNode;
}): ComponentDef {
  const Extra = o.extra;
  function CoilSymbol(props: SymbolProps) {
    return <CoilBox energized={props.state?.energized}>{Extra && <Extra {...props} />}</CoilBox>;
  }
  CoilSymbol.displayName = `Coil(${o.type})`;
  return {
    type: o.type,
    domain: "electric",
    category: "elec-outputs",
    labelPrefix: o.labelPrefix,
    width: ELEC_W,
    height: ELEC_H,
    ports: [...COIL_TERMINALS],
    params: [VOLTAGE, ...(o.params ?? [])],
    keywords: o.keywords,
    sim: { kind: "elec-load", load: o.load },
    Symbol: CoilSymbol,
  };
}

/** Bobina de relé auxiliar: aciona os contatos com o mesmo rótulo (K1…). */
export const relayCoil = makeCoil({
  type: "elec.relay.coil",
  load: "relay-coil",
  labelPrefix: "K",
  keywords: ["relé", "bobina", "auxiliar", "selo"],
});

/** Bobina de contator (mesmo comportamento do relé, para cargas de potência). */
export const contactorCoil = makeCoil({
  type: "elec.contactor.coil",
  load: "relay-coil",
  labelPrefix: "KM",
  keywords: ["contator", "bobina", "motor", "potência"],
});

/** Solenoide de válvula: energiza o solenoide com o mesmo rótulo na válvula (Y1…). */
export const solenoidCoil = makeCoil({
  type: "elec.solenoid.coil",
  load: "solenoid-coil",
  labelPrefix: "Y",
  keywords: ["solenoide", "bobina da válvula", "eletroválvula", "eletropneumática", "eletro-hidráulica"],
  extra: () => <line className="sym" x1={10} y1={38} x2={30} y2={22} />,
});

/** Relé temporizado com retardo na ligação: os contatos comutam `delay` segundos depois de energizar. */
export const timerOnCoil = makeCoil({
  type: "elec.timer.on-delay",
  load: "timer-on",
  labelPrefix: "K",
  params: [DELAY],
  keywords: ["temporizador", "relé de tempo", "retardo na ligação", "timer"],
  extra: ({ state }) => (
    <g>
      <rect className="sym sym-bg" x={30} y={25} width={8} height={10} />
      <path className="sym" d="M30 25 L38 35 M38 25 L30 35" />
      {state?.charge !== undefined && state.charge > 0 && state.charge < 1 && (
        <rect className="sym-energized" x={10} y={38} width={20 * state.charge} height={2} />
      )}
    </g>
  ),
});

/** Relé temporizado com retardo no desligamento: os contatos voltam `delay` segundos depois de desenergizar. */
export const timerOffCoil = makeCoil({
  type: "elec.timer.off-delay",
  load: "timer-off",
  labelPrefix: "K",
  params: [DELAY],
  keywords: ["temporizador", "relé de tempo", "retardo no desligamento", "timer"],
  extra: ({ state }) => (
    <g>
      <rect className="sym sym-solid" x={30} y={25} width={8} height={10} />
      {state?.charge !== undefined && state.charge > 0 && state.charge < 1 && (
        <rect className="sym-energized" x={10} y={38} width={20 * state.charge} height={2} />
      )}
    </g>
  ),
});

/** Contador: conta os pulsos na bobina; ao chegar no valor ajustado, comuta os contatos com o mesmo rótulo. */
export const counterCoil = makeCoil({
  type: "elec.counter.coil",
  load: "counter",
  labelPrefix: "C",
  params: [{ key: "preset", type: "number", default: 5, min: 1, max: 9999 }],
  keywords: ["contador", "contagem", "ciclos"],
  extra: ({ params, state }) => (
    <text className="sym-text" x={31} y={34} fontSize={8}>
      {state?.count ?? 0}/{typeof params.preset === "number" ? params.preset : 5}
    </text>
  ),
});

/** Bobina de reset do contador com o mesmo rótulo: energizada, zera a contagem. */
export const counterResetCoil = makeCoil({
  type: "elec.counter.reset",
  load: "counter-reset",
  labelPrefix: "C",
  keywords: ["contador", "reset", "zerar"],
  extra: () => (
    <text className="sym-text" x={20} y={33} fontSize={8} textAnchor="middle">
      R
    </text>
  ),
});

const LAMP_COLORS: Record<string, string> = { green: "#22c55e", red: "#ef4444", yellow: "#facc15", white: "#e5e7eb" };

/** Lâmpada de sinalização. */
export const lamp: ComponentDef = {
  type: "elec.lamp",
  domain: "electric",
  category: "elec-outputs",
  labelPrefix: "H",
  width: ELEC_W,
  height: ELEC_H,
  ports: [
    { id: "X1", x: 20, y: 0, kind: "electric" },
    { id: "X2", x: 20, y: ELEC_H, kind: "electric" },
  ],
  params: [VOLTAGE, { key: "color", type: "select", default: "green", options: ["green", "red", "yellow", "white"] }],
  keywords: ["sinaleiro", "indicador", "luz"],
  sim: { kind: "elec-load", load: "lamp" },
  Symbol: ({ params, state }) => (
    <g>
      <line className="sym" x1={20} y1={0} x2={20} y2={20} />
      <circle
        className={state?.energized ? "sym" : "sym sym-bg"}
        style={state?.energized ? { fill: LAMP_COLORS[String(params.color)] ?? LAMP_COLORS.green } : undefined}
        cx={20}
        cy={30}
        r={10}
      />
      <path className="sym" d="M13 23 L27 37 M27 23 L13 37" />
      <line className="sym" x1={20} y1={40} x2={20} y2={60} />
    </g>
  ),
};

/** Buzina (sinal sonoro). */
export const buzzer: ComponentDef = {
  type: "elec.buzzer",
  domain: "electric",
  category: "elec-outputs",
  labelPrefix: "H",
  width: ELEC_W,
  height: ELEC_H,
  ports: [...COIL_TERMINALS],
  params: [VOLTAGE],
  keywords: ["buzina", "alarme", "sirene", "sonoro"],
  sim: { kind: "elec-load", load: "buzzer" },
  Symbol: ({ state }) => (
    <g>
      <path className="sym" d="M20 0 V22 M20 38 V60" />
      <path className={state?.energized ? "sym sym-energized" : "sym sym-bg"} d="M10 38 A10 10 0 0 1 30 38 Z" transform="translate(0 -8)" />
      {state?.energized && <path className="sym sym-active" d="M33 22 q4 6 0 12 M36 19 q6 9 0 18" />}
    </g>
  ),
};
