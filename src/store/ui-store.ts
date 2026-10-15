/** Preferências de interface (tema, painéis). Guardadas no localStorage deste navegador. */
import { create } from "zustand";

export type Theme = "light" | "dark";
export type BottomTab = "charts" | "phases" | "parts" | "warnings";

const THEME_KEY = "fluxolab:theme";

interface UiState {
  theme: Theme;
  bottomOpen: boolean;
  bottomTab: BottomTab;
  openDialog: boolean;
  setTheme(theme: Theme): void;
  toggleTheme(): void;
  setBottomTab(tab: BottomTab): void;
  toggleBottom(): void;
  setOpenDialog(open: boolean): void;
}

/** Tema inicial: o que já foi aplicado no <html> pelo script do layout (evita "piscar"). */
function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export const useUi = create<UiState>()((set, get) => ({
  theme: readTheme(),
  bottomOpen: true,
  bottomTab: "parts",
  openDialog: false,
  setTheme(theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // modo privado ou armazenamento bloqueado: o tema vale só nesta sessão
    }
    set({ theme });
  },
  toggleTheme() {
    get().setTheme(get().theme === "dark" ? "light" : "dark");
  },
  setBottomTab(tab) {
    set({ bottomTab: tab, bottomOpen: true });
  },
  toggleBottom() {
    set({ bottomOpen: !get().bottomOpen });
  },
  setOpenDialog(open) {
    set({ openDialog: open });
  },
}));

/** Script executado antes da pintura da página, para aplicar o tema salvo (ou o do sistema). */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
