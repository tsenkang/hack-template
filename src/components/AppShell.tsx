"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUi } from "@/store/ui-store";
import { Canvas } from "@/editor/Canvas";
import { SimLegend } from "@/editor/SimLegend";
import { useSim } from "@/store/sim-store";
import { t } from "@/i18n";
import { loadLastProject } from "@/persistence/storage";
import { useEditor } from "@/store/editor-store";
import { BottomPanel } from "./BottomPanel";
import { CircuitTabs } from "./CircuitTabs";
import { CommandPalette } from "./CommandPalette";
import { OpenDialog } from "./OpenDialog";
import { PlcEditor } from "./plc/PlcEditor";
import { PropertiesPanel } from "./PropertiesPanel";
import { SidePanel } from "./SidePanel";
import { Toasts } from "./Toasts";
import { PresentationBar } from "./PresentationBar";
import { TopBar, Logo } from "./TopBar";
import { useAutosave } from "./useAutosave";
import { usePwa } from "./usePwa";
import { useShortcuts } from "./useShortcuts";

/**
 * Tela principal em 4 áreas: barra de cima, biblioteca (esquerda),
 * desenho com abas e painel de baixo (centro) e propriedades (direita).
 */
export function AppShell() {
  const [ready, setReady] = useState(false);
  const simulating = useSim((s) => s.status !== "stopped");
  const { leftDrawer, rightDrawer, presenting } = useUi(useShallow((s) => ({ leftDrawer: s.leftDrawer, rightDrawer: s.rightDrawer, presenting: s.presenting })));

  // Ao abrir o app, reabre o último projeto salvo neste navegador.
  useEffect(() => {
    loadLastProject()
      .then((project) => project && useEditor.getState().loadProject(project))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  useAutosave(ready);
  useShortcuts();
  usePwa();

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
      {presenting ? <PresentationBar /> : <TopBar />}
      <div
        className={clsx(
          "relative grid min-h-0 grid-cols-[minmax(0,1fr)]",
          !presenting && "lg:grid-cols-[15rem_minmax(0,1fr)_17rem] xl:grid-cols-[17rem_minmax(0,1fr)_19rem]",
        )}
      >
        {!presenting && (
          <div
            className={clsx(
              "min-h-0 lg:static lg:block lg:w-auto lg:shadow-none",
              leftDrawer ? "absolute inset-y-0 left-0 z-30 block w-[min(20rem,85vw)] shadow-2xl" : "hidden",
            )}
            data-testid="left-panel"
          >
            <SidePanel />
          </div>
        )}
        <main className="flex min-h-0 min-w-0 flex-col">
          {!presenting && <CircuitTabs />}
          {simulating && <SimLegend />}
          <div className="min-h-0 flex-1">
            <Canvas />
          </div>
          {!presenting && <BottomPanel />}
        </main>
        {!presenting && (
          <div
            className={clsx(
              "min-h-0 lg:static lg:block lg:w-auto lg:shadow-none",
              rightDrawer ? "absolute inset-y-0 right-0 z-30 block w-[min(20rem,85vw)] shadow-2xl" : "hidden",
            )}
            data-testid="right-panel"
          >
            <PropertiesPanel />
          </div>
        )}
        {(leftDrawer || rightDrawer) && (
          <button
            type="button"
            aria-label={t("dialogs.close")}
            className="absolute inset-0 z-20 bg-black/20 lg:hidden"
            onClick={() => useUi.getState().setDrawer("left", false)}
          />
        )}
      </div>
      <OpenDialog />
      <PlcEditor />
      <CommandPalette />
      <Toasts />
    </div>
  );
}
