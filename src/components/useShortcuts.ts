"use client";

import { useEffect } from "react";
import { fitAll, zoomBy } from "@/editor/actions";
import { useEditor } from "@/store/editor-store";
import { useSim } from "@/store/sim-store";
import { useUi } from "@/store/ui-store";
import { GRID } from "@/symbols/types";
import { saveNow, startSimulation } from "./project-actions";

/** Atalhos de teclado globais. Ignorados enquanto se digita num campo. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable], dialog")) return;
      const s = useEditor.getState();
      const sim = useSim.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Simulação: F5 inicia/pausa, Esc para. Enquanto simula, só zoom e controles da simulação.
      if (e.key === "F5") {
        e.preventDefault();
        if (sim.status === "running") sim.pause();
        else startSimulation();
        return;
      }
      if (sim.status !== "stopped") {
        if (e.key === "Escape") sim.stop();
        else if (e.key === "+" || e.key === "=") zoomBy(1.25);
        else if (e.key === "-") zoomBy(1 / 1.25);
        else if (e.key === "0") fitAll();
        else return;
        e.preventDefault();
        return;
      }

      const handled = (() => {
        if (mod) {
          switch (key) {
            case "z":
              if (e.shiftKey) s.redo();
              else s.undo();
              return true;
            case "y":
              s.redo();
              return true;
            case "c":
              s.copySelection();
              return true;
            case "x":
              s.cutSelection();
              return true;
            case "v":
              s.paste();
              return true;
            case "d":
              s.duplicateSelection();
              return true;
            case "a":
              s.selectAll();
              return true;
            case "s":
              saveNow();
              return true;
            case "o":
              useUi.getState().setOpenDialog(true);
              return true;
          }
          return false;
        }
        const step = e.shiftKey ? GRID * 5 : s.snapEnabled ? GRID : 1;
        switch (e.key) {
          case "Delete":
          case "Backspace":
            s.deleteSelection();
            return true;
          case "Escape":
            s.select([]);
            return true;
          case "ArrowLeft":
            s.nudgeSelection(-step, 0);
            return true;
          case "ArrowRight":
            s.nudgeSelection(step, 0);
            return true;
          case "ArrowUp":
            s.nudgeSelection(0, -step);
            return true;
          case "ArrowDown":
            s.nudgeSelection(0, step);
            return true;
          case "r":
          case "R":
            s.rotateSelection();
            return true;
          case "m":
          case "M":
            s.mirrorSelection();
            return true;
          case "+":
          case "=":
            zoomBy(1.25);
            return true;
          case "-":
            zoomBy(1 / 1.25);
            return true;
          case "0":
            fitAll();
            return true;
        }
        return false;
      })();
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
