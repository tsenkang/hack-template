import type { ComponentDef, SymbolProps } from "../types";

function MotorSymbol({ state }: SymbolProps) {
  const angle = ((state?.angle ?? 0) * Math.PI) / 180;
  return (
    <g>
      <path className="sym" d="M30 0 V12 M30 38 V50" />
      <circle className="sym sym-bg" cx={30} cy={25} r={13} />
      {/* triângulos cheios apontando para dentro: motor hidráulico, dois sentidos */}
      <polygon className="sym-solid" points="30,20 26,13 34,13" />
      <polygon className="sym-solid" points="30,30 26,37 34,37" />
      <path className="sym" d="M43 23 H54 M43 27 H54" />
      <line className="sym" x1={30} y1={25} x2={30 + 7 * Math.cos(angle)} y2={25 + 7 * Math.sin(angle)} />
      {state?.rpm !== undefined && Math.abs(state.rpm) > 1 && (
        <text className="sym-text" x={58} y={44} fontSize={8}>
          {Math.round(Math.abs(state.rpm))} rpm
        </text>
      )}
    </g>
  );
}

/** Motor hidráulico: gira para um lado com óleo em 1 e para o outro com óleo em 2. */
export const hydMotor: ComponentDef = {
  type: "hyd.motor",
  domain: "hydraulic",
  category: "hyd-actuators",
  labelPrefix: "A",
  width: 60,
  height: 50,
  ports: [
    { id: "1", x: 30, y: 50, kind: "hydraulic" },
    { id: "2", x: 30, y: 0, kind: "hydraulic" },
  ],
  params: [
    { key: "displacement", type: "number", unit: "cm³/rot", default: 10, min: 0.5, max: 1000 },
    { key: "torque", type: "number", unit: "N·m", default: 5, min: 0, max: 10000 },
    { key: "maxPressure", type: "number", unit: "bar", default: 210, min: 10, max: 500 },
  ],
  keywords: ["motor hidráulico", "rotativo", "guincho", "esteira"],
  sim: { kind: "hyd-motor" },
  Symbol: MotorSymbol,
};
