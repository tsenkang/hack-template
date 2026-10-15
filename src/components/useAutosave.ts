"use client";

import { useEffect } from "react";
import { saveProject } from "@/persistence/storage";
import { useEditor } from "@/store/editor-store";

const DELAY_MS = 800;

/** Salva o projeto no IndexedDB sempre que ele muda (com um pequeno atraso para agrupar mudanças). */
export function useAutosave(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useEditor.subscribe((state, prev) => {
      if (state.project === prev.project || state.gestureBase) return;
      clearTimeout(timer);
      timer = setTimeout(() => void saveProject(useEditor.getState().project), DELAY_MS);
    });
    // Ao fechar a aba, grava o que estiver pendente.
    const flush = () => void saveProject(useEditor.getState().project);
    window.addEventListener("pagehide", flush);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("pagehide", flush);
    };
  }, [enabled]);
}
