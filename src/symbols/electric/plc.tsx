/** CLP compacto: 8 entradas em cima (I0…I7), 8 saídas embaixo (Q0…Q7), alimentação L+ e M à esquerda. */
import { PLC_INPUTS, PLC_OUTPUTS } from "@/engine/logic/plc";
import type { ComponentDef, PortDef, SymbolProps } from "../types";

const W = 200;
const H = 80;
const X0 = 40;
const PITCH = 20;

const ports: PortDef[] = [
  { id: "L+", x: 20, y: 0, kind: "electric" },
  { id: "M", x: 20, y: H, kind: "electric" },
  ...Array.from({ length: PLC_INPUTS }, (_, k): PortDef => ({ id: `I${k}`, x: X0 + k * PITCH, y: 0, kind: "electric" })),
  ...Array.from({ length: PLC_OUTPUTS }, (_, k): PortDef => ({ id: `Q${k}`, x: X0 + k * PITCH, y: H, kind: "electric" })),
];

function PlcSymbol({ state }: SymbolProps) {
  const plc = state?.plc;
  const powered = state?.energized;
  return (
    <g>
      <rect className="sym sym-bg" x={8} y={10} width={W - 16} height={H - 20} rx={3} />
      {ports.map((p) => (
        <line key={p.id} className="sym" x1={p.x} y1={p.y} x2={p.x} y2={p.y === 0 ? 10 : H - 10} />
      ))}
      {Array.from({ length: PLC_INPUTS }, (_, k) => (
        <g key={`i${k}`}>
          <rect className={plc?.inputs[k] ? "sym sym-energized" : "sym sym-bg"} x={X0 + k * PITCH - 4} y={14} width={8} height={6} />
          <text className="sym-text" x={X0 + k * PITCH} y={29} fontSize={7} textAnchor="middle">
            I{k}
          </text>
        </g>
      ))}
      {Array.from({ length: PLC_OUTPUTS }, (_, k) => (
        <g key={`q${k}`}>
          <rect className={plc?.outputs[k] ? "sym sym-energized" : "sym sym-bg"} x={X0 + k * PITCH - 4} y={H - 20} width={8} height={6} />
          <text className="sym-text" x={X0 + k * PITCH} y={H - 24} fontSize={7} textAnchor="middle">
            Q{k}
          </text>
        </g>
      ))}
      <text className="sym-text" x={20} y={24} fontSize={7} textAnchor="middle">
        L+
      </text>
      <text className="sym-text" x={20} y={H - 14} fontSize={7} textAnchor="middle">
        M
      </text>
      <text className="sym-text" x={W / 2} y={H / 2 + 3} fontSize={9} textAnchor="middle" fontWeight={600}>
        CLP {powered ? (plc?.steps.length ? `· X${plc.steps.join(" X")}` : "· RUN") : ""}
      </text>
    </g>
  );
}

export const plc: ComponentDef = {
  type: "elec.plc",
  domain: "electric",
  category: "elec-plc",
  labelPrefix: "CLP",
  width: W,
  height: H,
  ports,
  params: [{ key: "program", type: "program", default: "" }],
  keywords: ["clp", "plc", "controlador", "ladder", "grafcet", "programável", "sfc"],
  sim: { kind: "elec-plc" },
  Symbol: PlcSymbol,
};
