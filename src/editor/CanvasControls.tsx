"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Copy,
  FlipHorizontal2,
  Magnet,
  Maximize,
  RotateCw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { t } from "@/i18n";
import { selectViewport, useEditor } from "@/store/editor-store";
import { fitAll, zoomBy } from "./actions";
import type { AlignMode } from "./geometry";

const ALIGN: { mode: AlignMode; icon: typeof AlignStartVertical; label: Parameters<typeof t>[0] }[] = [
  { mode: "left", icon: AlignStartVertical, label: "canvas.alignLeft" },
  { mode: "centerH", icon: AlignCenterVertical, label: "canvas.alignCenterH" },
  { mode: "right", icon: AlignEndVertical, label: "canvas.alignRight" },
  { mode: "top", icon: AlignStartHorizontal, label: "canvas.alignTop" },
  { mode: "centerV", icon: AlignCenterHorizontal, label: "canvas.alignCenterV" },
  { mode: "bottom", icon: AlignEndHorizontal, label: "canvas.alignBottom" },
];

const panel = "pointer-events-auto flex items-center gap-0.5 rounded-lg border border-line bg-panel p-1 shadow-sm";

/** Botões flutuantes sobre o desenho: ações da seleção (em cima) e zoom/ímã (embaixo). */
export function CanvasControls({ snapEnabled, zoomOnly }: { snapEnabled: boolean; zoomOnly: boolean }) {
  const count = useEditor((s) => s.selection.length);
  const zoom = useEditor((s) => selectViewport(s).zoom);
  const s = useEditor.getState;

  return (
    <>
      {count > 0 && !zoomOnly && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2">
          <div className={panel} role="toolbar" aria-label={t("properties.title")}>
            <IconButton label={t("canvas.rotate")} onClick={() => s().rotateSelection()}>
              <RotateCw size={16} />
            </IconButton>
            <IconButton label={t("canvas.mirror")} onClick={() => s().mirrorSelection()}>
              <FlipHorizontal2 size={16} />
            </IconButton>
            <IconButton label={t("canvas.duplicate")} onClick={() => s().duplicateSelection()}>
              <Copy size={16} />
            </IconButton>
            <IconButton label={t("canvas.delete")} onClick={() => s().deleteSelection()}>
              <Trash2 size={16} />
            </IconButton>
            {count > 1 && (
              <>
                <span className="mx-1 h-5 w-px bg-line" />
                {ALIGN.map(({ mode, icon: Icon, label }) => (
                  <IconButton key={mode} label={t(label)} onClick={() => s().alignSelection(mode)}>
                    <Icon size={16} />
                  </IconButton>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute right-2 bottom-2 flex">
        <div className={panel}>
          {!zoomOnly && (
            <>
              <IconButton label={t("canvas.snap")} active={snapEnabled} onClick={() => s().toggleSnap()}>
                <Magnet size={16} />
              </IconButton>
              <span className="mx-1 h-5 w-px bg-line" />
            </>
          )}
          <IconButton label={t("canvas.zoomOut")} onClick={() => zoomBy(1 / 1.25)}>
            <ZoomOut size={16} />
          </IconButton>
          <span className="w-12 text-center text-xs tabular-nums text-muted" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <IconButton label={t("canvas.zoomIn")} onClick={() => zoomBy(1.25)}>
            <ZoomIn size={16} />
          </IconButton>
          <IconButton label={t("canvas.fit")} onClick={fitAll}>
            <Maximize size={16} />
          </IconButton>
        </div>
      </div>
    </>
  );
}
