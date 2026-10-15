import type { ComponentDef } from "@/symbols/types";
import { defaultParams } from "@/symbols/registry";

/** Miniatura do símbolo, usada na biblioteca e no painel de propriedades. */
export function SymbolPreview({ def, className }: { def: ComponentDef; className?: string }) {
  const { Symbol } = def;
  const pad = 4;
  return (
    <svg
      className={className}
      viewBox={`${-pad} ${-pad} ${def.width + 2 * pad} ${def.height + 2 * pad}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <Symbol params={defaultParams(def)} />
    </svg>
  );
}
