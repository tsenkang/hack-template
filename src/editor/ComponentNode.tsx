"use client";

import { memo } from "react";
import type { ComponentInstance } from "@/engine/core/types";
import { tDynamic } from "@/i18n";
import { getDef } from "@/symbols/registry";
import { componentBounds, localToWorld, svgTransform } from "./geometry";

interface Props {
  comp: ComponentInstance;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
}

/** Uma peça no desenho: símbolo, conectores, rótulo e contorno de seleção. */
export const ComponentNode = memo(function ComponentNode({ comp, selected, onPointerDown }: Props) {
  const def = getDef(comp.type);
  if (!def) return null;
  const { Symbol } = def;
  const b = componentBounds(comp, def);
  const name = tDynamic(`parts.${comp.type}.name`);

  return (
    <g
      className="component"
      data-component-id={comp.id}
      data-type={comp.type}
      role="button"
      aria-label={comp.label ? `${name} ${comp.label}` : name}
      aria-pressed={selected}
      onPointerDown={(e) => onPointerDown(e, comp.id)}
    >
      <g transform={svgTransform(comp, def)}>
        {/* área de clique: a caixa inteira, não só os traços */}
        <rect className="hit" x={0} y={0} width={def.width} height={def.height} />
        <Symbol params={comp.params} />
      </g>
      {def.ports.map((p) => {
        const w = localToWorld(comp, def, p);
        return (
          <g key={p.id} className="port" data-export-ignore data-port-id={p.id}>
            <circle className="port-hit" cx={w.x} cy={w.y} r={7} />
            <circle className={`port-dot port-${p.kind}`} cx={w.x} cy={w.y} r={2.5} />
          </g>
        );
      })}
      {comp.label && (
        <text className="label" x={b.x + b.w + 3} y={b.y + 9}>
          {comp.label}
        </text>
      )}
      {selected && (
        <rect
          className="selection-outline"
          data-export-ignore
          x={b.x - 4}
          y={b.y - 4}
          width={b.w + 8}
          height={b.h + 8}
          rx={3}
        />
      )}
    </g>
  );
});
