/**
 * Botões, chaves, contatos de relé, fins de curso, sensores e pressostato.
 * Todos têm o contato na vertical (terminal 1 em cima, 2 embaixo), como no esquema em escada.
 */
import type { ContactDrive } from "@/engine/core/sim-types";
import type { ComponentDef, ParamDef, SymbolProps } from "../types";
import {
  Contact,
  DetentMark,
  ELEC_H,
  ELEC_W,
  MushroomOperator,
  PushOperator,
  RollerOperator,
  SelectorOperator,
  SensorOperator,
} from "./draw";

const TERMINALS = [
  { id: "1", x: 20, y: 0, kind: "electric" },
  { id: "2", x: 20, y: ELEC_H, kind: "electric" },
] as const;

/** Rótulo da haste e posição no curso (fins de curso e sensores). */
const POSITION_PARAMS: ParamDef[] = [
  { key: "cylinder", type: "text", default: "A1" },
  { key: "position", type: "number", unit: "%", default: 100, min: 0, max: 100 },
];

interface SwitchOptions {
  type: string;
  normally: "open" | "closed";
  drive: ContactDrive;
  labelPrefix: string;
  operator?: (props: { y?: number }) => React.ReactNode;
  params?: ParamDef[];
  tolerance?: number;
  /** Rótulo que aponta para uma bobina (K1 dos contatos): começa em "K1", não é numerado sozinho. */
  referenceLabel?: boolean;
  keywords: string[];
  interactive?: boolean;
}

function makeSwitch(o: SwitchOptions): ComponentDef {
  const Operator = o.operator;
  function SwitchSymbol({ state }: SymbolProps) {
    return (
      <g>
        <Contact normally={o.normally} closed={state?.closed} />
        {Operator && <Operator />}
      </g>
    );
  }
  SwitchSymbol.displayName = `Switch(${o.type})`;
  return {
    type: o.type,
    domain: "electric",
    category: "elec-switches",
    labelPrefix: o.labelPrefix,
    referenceLabel: o.referenceLabel,
    width: ELEC_W,
    height: ELEC_H,
    ports: [...TERMINALS],
    params: o.params ?? [],
    keywords: o.keywords,
    interactive: o.interactive ?? true,
    sim: { kind: "elec-switch", drive: o.drive, contacts: [{ a: "1", b: "2", normally: o.normally }], tolerance: o.tolerance },
    Symbol: SwitchSymbol,
  };
}

export const pushbuttonNO = makeSwitch({
  type: "elec.pushbutton.no",
  normally: "open",
  drive: "push",
  labelPrefix: "S",
  operator: PushOperator,
  keywords: ["botão", "liga", "start", "pulsador", "na"],
});

export const pushbuttonNC = makeSwitch({
  type: "elec.pushbutton.nc",
  normally: "closed",
  drive: "push",
  labelPrefix: "S",
  operator: PushOperator,
  keywords: ["botão", "desliga", "stop", "pulsador", "nf"],
});

export const pushbuttonLatching = makeSwitch({
  type: "elec.pushbutton.latching",
  normally: "open",
  drive: "toggle",
  labelPrefix: "S",
  operator: ({ y }) => (
    <g>
      <PushOperator y={y} />
      <DetentMark y={y} />
    </g>
  ),
  keywords: ["botão com trava", "retenção", "liga-desliga"],
});

export const emergencyStop = makeSwitch({
  type: "elec.pushbutton.emergency",
  normally: "closed",
  drive: "emergency",
  labelPrefix: "S",
  operator: ({ y }) => (
    <g>
      <MushroomOperator y={y} />
      <DetentMark y={y} />
    </g>
  ),
  keywords: ["emergência", "cogumelo", "parada", "segurança", "botoeira"],
});

export const selector2 = makeSwitch({
  type: "elec.selector.2pos",
  normally: "open",
  drive: "toggle",
  labelPrefix: "S",
  operator: SelectorOperator,
  keywords: ["seletora", "chave", "manual/automático", "2 posições"],
});

export const relayContactNO = makeSwitch({
  type: "elec.relay.contact-no",
  normally: "open",
  drive: "relay",
  labelPrefix: "K",
  referenceLabel: true,
  interactive: false,
  keywords: ["relé", "contato", "selo", "na", "contator", "temporizador"],
});

export const relayContactNC = makeSwitch({
  type: "elec.relay.contact-nc",
  normally: "closed",
  drive: "relay",
  labelPrefix: "K",
  referenceLabel: true,
  interactive: false,
  keywords: ["relé", "contato", "intertravamento", "nf", "contator"],
});

export const limitSwitchNO = makeSwitch({
  type: "elec.limit.no",
  normally: "open",
  drive: "position",
  labelPrefix: "S",
  operator: RollerOperator,
  params: POSITION_PARAMS,
  tolerance: 2,
  keywords: ["fim de curso", "chave de fim de curso", "rolete", "mecânico", "na"],
});

export const limitSwitchNC = makeSwitch({
  type: "elec.limit.nc",
  normally: "closed",
  drive: "position",
  labelPrefix: "S",
  operator: RollerOperator,
  params: POSITION_PARAMS,
  tolerance: 2,
  keywords: ["fim de curso", "rolete", "mecânico", "nf"],
});

const SENSORS = [
  { kind: "inductive", tolerance: 5, keywords: ["indutivo", "metal", "proximidade"] },
  { kind: "capacitive", tolerance: 5, keywords: ["capacitivo", "proximidade", "nível"] },
  { kind: "optical", tolerance: 8, keywords: ["óptico", "fotoelétrico", "luz", "barreira"] },
  { kind: "reed", tolerance: 3, keywords: ["reed", "magnético", "sensor de cilindro", "ímã"] },
] as const;

export const [sensorInductive, sensorCapacitive, sensorOptical, sensorReed] = SENSORS.map((s) =>
  makeSwitch({
    type: `elec.sensor.${s.kind}`,
    normally: "open",
    drive: "position",
    labelPrefix: "B",
    operator: ({ y }) => <SensorOperator kind={s.kind} y={y} />,
    params: POSITION_PARAMS,
    tolerance: s.tolerance,
    interactive: false,
    keywords: ["sensor", ...s.keywords],
  }),
);

/** Pressostato: contato NA que fecha quando a pressão no conector pneumático P passa do ajuste. */
export const pressureSwitch: ComponentDef = {
  ...makeSwitch({
    type: "elec.pressure-switch",
    normally: "open",
    drive: "pressure",
    labelPrefix: "B",
    operator: ({ y = 30 }) => (
      <g>
        <line className="sym sym-dashed" x1={10} y1={y} x2={15} y2={y} />
        <path className="sym" d={`M0 ${y} H4`} />
        <rect className="sym sym-bg" x={4} y={y - 5} width={6} height={10} />
        <text className="sym-text" x={7} y={y + 3} fontSize={7} textAnchor="middle">
          P
        </text>
      </g>
    ),
    params: [{ key: "setPressure", type: "number", unit: "bar", default: 4, min: 0.2, max: 400, step: 0.1 }],
    interactive: false,
    keywords: ["pressostato", "pressão", "chave de pressão"],
  }),
  ports: [...TERMINALS, { id: "P", x: 0, y: 30, kind: "pneumatic" }],
};

/** Contato reversor (comutador) de relé: 11 comum, 12 NF, 14 NA. */
export const relayChangeover: ComponentDef = {
  type: "elec.relay.changeover",
  domain: "electric",
  category: "elec-switches",
  labelPrefix: "K",
  referenceLabel: true,
  width: ELEC_W,
  height: ELEC_H,
  ports: [
    { id: "12", x: 10, y: 0, kind: "electric" },
    { id: "14", x: 30, y: 0, kind: "electric" },
    { id: "11", x: 20, y: ELEC_H, kind: "electric" },
  ],
  params: [],
  keywords: ["relé", "reversor", "comutador", "contato reversível"],
  sim: {
    kind: "elec-switch",
    drive: "relay",
    contacts: [
      { a: "11", b: "12", normally: "closed" },
      { a: "11", b: "14", normally: "open" },
    ],
  },
  Symbol: ({ state }) => {
    // `closed` = primeiro contato (11–12, NF) fechado → relé em repouso
    const atRest = state?.closed ?? true;
    return (
      <g>
        <path className="sym" d="M10 0 V20 M30 0 V20 M20 40 V60 M10 20 H16" />
        <line className={atRest ? "sym" : "sym sym-active"} x1={20} y1={40} x2={atRest ? 14 : 30} y2={atRest ? 18 : 21} />
      </g>
    );
  },
};

/** Chave seletora de 3 posições: esquerda liga 1–2, direita liga 1–4, centro desliga. */
export const selector3: ComponentDef = {
  type: "elec.selector.3pos",
  domain: "electric",
  category: "elec-switches",
  labelPrefix: "S",
  width: ELEC_W,
  height: ELEC_H,
  ports: [
    { id: "1", x: 20, y: 0, kind: "electric" },
    { id: "2", x: 10, y: ELEC_H, kind: "electric" },
    { id: "4", x: 30, y: ELEC_H, kind: "electric" },
  ],
  params: [],
  keywords: ["seletora", "3 posições", "manual-0-automático", "reversão"],
  interactive: true,
  sim: { kind: "elec-selector3" },
  Symbol: ({ state }) => {
    const pos = state?.position ?? 0;
    const tip = pos === -1 ? 10 : pos === 1 ? 30 : 20;
    return (
      <g>
        <path className="sym" d="M20 0 V20 M10 40 V60 M30 40 V60" />
        <line className={pos === 0 ? "sym" : "sym sym-active"} x1={20} y1={20} x2={tip} y2={pos === 0 ? 34 : 40} />
        <circle className="sym-solid" cx={20} cy={20} r={1.5} />
        <SelectorOperator y={30} />
      </g>
    );
  },
};
