"use client";

import { Maximize, Minimize2, Pause, Play, Square, StepForward } from "lucide-react";
import { fitAll } from "@/editor/actions";
import { t } from "@/i18n";
import { useEditor } from "@/store/editor-store";
import { useSim } from "@/store/sim-store";
import { useUi } from "@/store/ui-store";
import { IconButton } from "./IconButton";
import { startSimulation } from "./project-actions";
import { Logo } from "./TopBar";

/** Entra no modo apresentação: tela cheia, só o desenho e os controles da simulação. */
export function enterPresentation() {
  useUi.getState().setPresenting(true);
  document.documentElement.requestFullscreen?.().catch(() => undefined);
  setTimeout(fitAll, 50);
}

export function exitPresentation() {
  useUi.getState().setPresenting(false);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  setTimeout(fitAll, 50);
}

/** Barra do modo apresentação (projetor em sala de aula): grande e enxuta. */
export function PresentationBar() {
  const status = useSim((s) => s.status);
  const name = useEditor((s) => s.project.name);
  const tab = useEditor((s) => s.project.circuits.find((c) => c.id === s.activeCircuitId)?.name ?? "");
  const sim = useSim.getState;
  const big = "h-11 min-w-11";
  return (
    <header className="flex h-14 items-center gap-2 border-b border-line bg-panel px-3" data-testid="presentation-bar">
      <Logo />
      <span className="truncate text-lg font-semibold">
        {name} <span className="font-normal text-muted">· {tab}</span>
      </span>
      <span className="flex-1" />
      {status === "running" ? (
        <IconButton className={big} label={`${t("toolbar.pause")} (F5)`} active onClick={() => sim().pause()}>
          <Pause size={24} />
        </IconButton>
      ) : (
        <IconButton className={big} label={`${t("toolbar.play")} (F5)`} onClick={startSimulation}>
          <Play size={24} />
        </IconButton>
      )}
      <IconButton className={big} label={t("toolbar.stop")} disabled={status === "stopped"} onClick={() => sim().stop()}>
        <Square size={20} />
      </IconButton>
      <IconButton className={big} label={t("toolbar.step")} onClick={() => sim().step()}>
        <StepForward size={24} />
      </IconButton>
      <IconButton className={big} label={t("canvas.fit")} onClick={fitAll}>
        <Maximize size={22} />
      </IconButton>
      <button
        type="button"
        onClick={exitPresentation}
        className="ml-2 inline-flex h-11 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium hover:bg-hover"
        data-testid="exit-presentation"
      >
        <Minimize2 size={18} aria-hidden /> {t("present.exit")}
      </button>
    </header>
  );
}
