"use client";

import {
  ChevronDown,
  Download,
  FilePlus2,
  FolderOpen,
  Moon,
  Pause,
  Play,
  Redo2,
  Save,
  Square,
  StepForward,
  Sun,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "@/i18n";
import { useEditor } from "@/store/editor-store";
import { useUi } from "@/store/ui-store";
import { IconButton } from "./IconButton";
import { exportImage, exportJson, newProject, saveNow } from "./project-actions";

const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 5, 10];
const divider = <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />;

/** Barra de cima: arquivo, desfazer/refazer, simulação, exportar e tema. */
export function TopBar() {
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const projectName = useEditor((s) => s.project.name);
  const theme = useUi((s) => s.theme);
  const s = useEditor.getState;

  return (
    <header className="flex h-12 items-center gap-1 border-b border-line bg-panel px-2">
      <div className="mr-2 flex items-center gap-2">
        <Logo />
        <span className="hidden font-semibold tracking-tight md:inline">{t("app.name")}</span>
      </div>
      <input
        key={projectName}
        defaultValue={projectName}
        aria-label={t("toolbar.projectName")}
        title={t("toolbar.projectName")}
        className="h-8 w-40 min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm hover:border-line focus:border-accent focus:outline-none"
        onBlur={(e) => {
          const name = e.target.value.trim();
          if (name && name !== projectName) s().setProjectName(name);
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
      {divider}
      <IconButton label={t("toolbar.new")} onClick={newProject}>
        <FilePlus2 size={18} />
      </IconButton>
      <IconButton label={`${t("toolbar.open")} (Ctrl+O)`} onClick={() => useUi.getState().setOpenDialog(true)}>
        <FolderOpen size={18} />
      </IconButton>
      <IconButton label={`${t("toolbar.save")} (Ctrl+S)`} onClick={saveNow}>
        <Save size={18} />
      </IconButton>
      <ExportMenu />
      {divider}
      <IconButton label={`${t("toolbar.undo")} (Ctrl+Z)`} disabled={!canUndo} onClick={() => s().undo()}>
        <Undo2 size={18} />
      </IconButton>
      <IconButton label={`${t("toolbar.redo")} (Ctrl+Y)`} disabled={!canRedo} onClick={() => s().redo()}>
        <Redo2 size={18} />
      </IconButton>
      {divider}
      {/* Controles da simulação: ficam visíveis desde já e são ligados na Fase 2. */}
      <div className="flex items-center gap-0.5" title={t("toolbar.simComingSoon")}>
        <IconButton label={t("toolbar.play")} disabled>
          <Play size={18} />
        </IconButton>
        <IconButton label={t("toolbar.pause")} disabled>
          <Pause size={18} />
        </IconButton>
        <IconButton label={t("toolbar.stop")} disabled>
          <Square size={16} />
        </IconButton>
        <IconButton label={t("toolbar.step")} disabled>
          <StepForward size={18} />
        </IconButton>
        <select
          aria-label={t("toolbar.speed")}
          disabled
          defaultValue={1}
          className="ml-1 hidden h-8 rounded-md border border-line bg-panel px-1 text-xs disabled:opacity-40 lg:block"
        >
          {SPEEDS.map((v) => (
            <option key={v} value={v}>
              {v.toLocaleString("pt-BR")}×
            </option>
          ))}
        </select>
      </div>
      <span className="flex-1" />
      <IconButton
        label={theme === "dark" ? t("toolbar.themeLight") : t("toolbar.themeDark")}
        onClick={() => useUi.getState().toggleTheme()}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </IconButton>
    </header>
  );
}

function ExportMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = (label: string, action: () => void, disabled = false) => (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className="block w-full px-3 py-2 text-left text-sm hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
      onClick={() => {
        setOpen(false);
        action();
      }}
    >
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <IconButton label={t("toolbar.export")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Download size={18} />
        <ChevronDown size={12} />
      </IconButton>
      {open && (
        <div role="menu" className="absolute top-9 left-0 z-40 w-56 rounded-md border border-line bg-panel py-1 shadow-lg">
          {item(t("toolbar.exportJson"), exportJson)}
          {item(t("toolbar.exportSvg"), () => exportImage("svg"))}
          {item(t("toolbar.exportPng"), () => exportImage("png"))}
          {item(t("toolbar.exportPdf"), () => {}, true)}
        </div>
      )}
    </div>
  );
}

/** Logotipo: um cilindro estilizado. */
export function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <rect x="5" y="11" width="16" height="10" rx="1.5" fill="none" stroke="#fff" strokeWidth="2" />
      <rect x="9" y="12.5" width="2.5" height="7" fill="#fff" />
      <rect x="11" y="15" width="16" height="2" fill="#fff" />
    </svg>
  );
}
