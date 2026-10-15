"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@/editor/Canvas";
import { t } from "@/i18n";
import { loadLastProject } from "@/persistence/storage";
import { useEditor } from "@/store/editor-store";
import { BottomPanel } from "./BottomPanel";
import { CircuitTabs } from "./CircuitTabs";
import { Library } from "./Library";
import { OpenDialog } from "./OpenDialog";
import { PropertiesPanel } from "./PropertiesPanel";
import { Toasts } from "./Toasts";
import { TopBar, Logo } from "./TopBar";
import { useAutosave } from "./useAutosave";
import { useShortcuts } from "./useShortcuts";

/**
 * Tela principal em 4 áreas: barra de cima, biblioteca (esquerda),
 * desenho com abas e painel de baixo (centro) e propriedades (direita).
 */
export function AppShell() {
  const [ready, setReady] = useState(false);

  // Ao abrir o app, reabre o último projeto salvo neste navegador.
  useEffect(() => {
    loadLastProject()
      .then((project) => project && useEditor.getState().loadProject(project))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  useAutosave(ready);
  useShortcuts();

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center gap-3 text-muted">
        <Logo />
        <span>{t("app.name")}…</span>
      </div>
    );
  }

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] overflow-hidden select-none">
      <TopBar />
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] md:grid-cols-[15rem_minmax(0,1fr)_17rem] xl:grid-cols-[17rem_minmax(0,1fr)_19rem]">
        <div className="hidden min-h-0 md:block">
          <Library />
        </div>
        <main className="flex min-h-0 min-w-0 flex-col">
          <CircuitTabs />
          <div className="min-h-0 flex-1">
            <Canvas />
          </div>
          <BottomPanel />
        </main>
        <div className="hidden min-h-0 md:block">
          <PropertiesPanel />
        </div>
      </div>
      <OpenDialog />
      <Toasts />
    </div>
  );
}
