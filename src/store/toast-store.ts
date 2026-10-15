/** Avisos rápidos no canto da tela ("Projeto salvo", erros de arquivo…). */
import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
  /** Botão opcional (ex.: "Recarregar"). Avisos com botão ficam até serem usados ou fechados. */
  action?: { label: string; run(): void };
}

interface ToastState {
  toasts: Toast[];
  show(message: string, tone?: Toast["tone"], action?: Toast["action"]): void;
  dismiss(id: number): void;
}

let seq = 0;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  show(message, tone = "info", action) {
    const id = ++seq;
    set({ toasts: [...get().toasts, { id, message, tone, action }] });
    if (!action) setTimeout(() => get().dismiss(id), tone === "error" ? 6000 : 3000);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = (message: string, tone?: Toast["tone"]) => useToasts.getState().show(message, tone);
