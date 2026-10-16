"use client";

import clsx from "clsx";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { t } from "@/i18n";
import { useEditor } from "@/store/editor-store";
import { IconButton } from "./IconButton";

/** Abas de circuitos do projeto (ex.: "Potência" e "Comando"). */
export function CircuitTabs() {
  const circuits = useEditor((s) => s.project.circuits);
  const activeId = useEditor((s) => s.activeCircuitId);
  const [editing, setEditing] = useState<string | null>(null);
  const s = useEditor.getState;

  const active = circuits.find((c) => c.id === activeId);
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-line bg-panel px-2">
      <div className="flex items-center gap-0.5" role="tablist" aria-label={t("tabs.list")}>
        {circuits.map((c) => {
          const isActive = c.id === activeId;
          return editing === c.id ? (
            <input
              key={c.id}
              autoFocus
              defaultValue={c.name}
              aria-label={t("tabs.rename")}
              className="h-7 w-36 rounded border border-accent bg-app px-1 text-xs outline-none"
              onBlur={(e) => {
                s().renameCircuit(c.id, e.target.value);
                setEditing(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditing(null);
              }}
            />
          ) : (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              title={t("tabs.rename")}
              onClick={() => s().setActiveCircuit(c.id)}
              onDoubleClick={() => setEditing(c.id)}
              className={clsx(
                "-mb-px shrink-0 border-b-2 px-3 py-2 text-xs font-medium",
                isActive ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      {circuits.length > 1 && active && (
        <IconButton
          label={`${t("tabs.close")}: ${active.name}`}
          onClick={() => {
            if (active.components.length === 0 || confirm(t("tabs.confirmClose", { name: active.name }))) s().removeCircuit(active.id);
          }}
        >
          <X size={14} />
        </IconButton>
      )}
      <IconButton label={t("tabs.newCircuit")} onClick={() => s().addCircuit()}>
        <Plus size={16} />
      </IconButton>
    </div>
  );
}
