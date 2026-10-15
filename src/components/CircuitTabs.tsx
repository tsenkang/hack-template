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

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-line bg-panel px-2" role="tablist">
      {circuits.map((c) => {
        const active = c.id === activeId;
        return (
          <div
            key={c.id}
            className={clsx(
              "group -mb-px flex shrink-0 items-center border-b-2",
              active ? "border-accent" : "border-transparent",
            )}
          >
            {editing === c.id ? (
              <input
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
                type="button"
                role="tab"
                aria-selected={active}
                title={t("tabs.rename")}
                onClick={() => s().setActiveCircuit(c.id)}
                onDoubleClick={() => setEditing(c.id)}
                className={clsx("px-3 py-2 text-xs font-medium", active ? "text-accent" : "text-muted hover:text-fg")}
              >
                {c.name}
              </button>
            )}
            {circuits.length > 1 && (
              <button
                type="button"
                aria-label={`${t("tabs.close")}: ${c.name}`}
                title={t("tabs.close")}
                className="mr-1 rounded p-0.5 text-muted opacity-0 group-hover:opacity-100 hover:bg-hover hover:text-fg focus-visible:opacity-100"
                onClick={() => {
                  if (c.components.length === 0 || confirm(t("tabs.confirmClose", { name: c.name }))) s().removeCircuit(c.id);
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}
      <IconButton label={t("tabs.newCircuit")} onClick={() => s().addCircuit()}>
        <Plus size={16} />
      </IconButton>
    </div>
  );
}
