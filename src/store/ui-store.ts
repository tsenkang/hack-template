/** Preferências de interface (tema, painéis). Guardadas no localStorage deste navegador. */
import { create } from "zustand";

export type Theme = "light" | "dark";
export type BottomTab = "charts" | "phases" | "parts" | "warnings";
/** Aluno: interface enxuta, sem soluções. Professor: cria exercícios e vê as soluções. */
export type Role = "student" | "teacher";
export type SideTab = "parts" | "circuits" | "exercises";

const THEME_KEY = "fluxolab:theme";
const ROLE_KEY = "fluxolab:role";

function readRole(): Role {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(ROLE_KEY) === "teacher" ? "teacher" : "student";
  } catch {
    return "student";
  }
}

interface UiState {
  theme: Theme;
  bottomOpen: boolean;
  bottomTab: BottomTab;
  openDialog: boolean;
  plcEditor: boolean;
  palette: boolean;
  /** Modo Explique: o painel da direita explica a peça clicada e o que ela está fazendo agora. */
  explain: boolean;
  role: Role;
  sideTab: SideTab;
  /** Telas estreitas (tablet em pé, celular): biblioteca e propriedades viram gavetas. */
  leftDrawer: boolean;
  rightDrawer: boolean;
  /** Modo apresentação: só o desenho e os controles da simulação, em tela cheia. */
  presenting: boolean;
  setDrawer(side: "left" | "right", open: boolean): void;
  setPresenting(on: boolean): void;
  setPlcEditor(open: boolean): void;
  setPalette(open: boolean): void;
  toggleExplain(): void;
  setRole(role: Role): void;
  setSideTab(tab: SideTab): void;
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
  plcEditor: false,
  palette: false,
  explain: false,
  role: readRole(),
  sideTab: "parts",
  leftDrawer: false,
  rightDrawer: false,
  presenting: false,
  setDrawer(side, open) {
    set(side === "left" ? { leftDrawer: open, rightDrawer: false } : { rightDrawer: open, leftDrawer: false });
  },
  setPresenting(on) {
    set({ presenting: on, leftDrawer: false, rightDrawer: false });
  },
  setPlcEditor(open) {
    set({ plcEditor: open });
  },
  setPalette(open) {
    set({ palette: open });
  },
  toggleExplain() {
    set({ explain: !get().explain });
  },
  setRole(role) {
    try {
      localStorage.setItem(ROLE_KEY, role);
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
    set({ role });
  },
  setSideTab(tab) {
    set({ sideTab: tab });
  },
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
