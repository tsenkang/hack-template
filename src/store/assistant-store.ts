/** Estado do assistente que monta circuitos (fica guardado ao trocar de aba do painel). */
import { create } from "zustand";
import type { AssistantResult, AssistantStatus } from "@/assistant/agent";
import type { AssistantLevel } from "@/assistant/prompt";

const KEY_STORAGE = "fluxolab:anthropic-key";
const LEVEL_STORAGE = "fluxolab:assistant-level";

const read = (k: string) => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
};

interface AssistantState {
  apiKey: string;
  level: AssistantLevel;
  description: string;
  status: AssistantStatus | null;
  result: AssistantResult | null;
  error: { kind: string; detail?: string } | null;
  setApiKey(key: string): void;
  setLevel(level: AssistantLevel): void;
  setDescription(text: string): void;
  set(patch: Partial<Pick<AssistantState, "status" | "result" | "error">>): void;
}

const savedLevel = read(LEVEL_STORAGE);

export const useAssistant = create<AssistantState>()((set) => ({
  apiKey: read(KEY_STORAGE) ?? "",
  level: savedLevel === "intermediate" || savedLevel === "advanced" ? savedLevel : "basic",
  description: "",
  status: null,
  result: null,
  error: null,
  setApiKey(key) {
    write(KEY_STORAGE, key || null);
    set({ apiKey: key });
  },
  setLevel(level) {
    write(LEVEL_STORAGE, level);
    set({ level });
  },
  setDescription(description) {
    set({ description });
  },
  set(patch) {
    set(patch);
  },
}));
