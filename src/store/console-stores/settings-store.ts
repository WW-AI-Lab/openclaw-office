import { create } from "zustand";

type ThemePreference = "light" | "dark" | "system";

const THEME_KEY = "openclaw-console-theme";
const LANG_KEY = "openclaw-console-lang";
const DEV_MODE_KEY = "openclaw-console-dev-mode";

function readLocal(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

function readLocalBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const val = localStorage.getItem(key);
  if (val === null) return fallback;
  return val === "true";
}

interface ConsoleSettingsState {
  theme: ThemePreference;
  language: string;
  devModeUnlocked: boolean;

  setTheme: (theme: ThemePreference) => void;
  setLanguage: (lang: string) => void;
  setDevModeUnlocked: (v: boolean) => void;
}

export const useConsoleSettingsStore = create<ConsoleSettingsState>((set) => ({
  theme: readLocal(THEME_KEY, "system") as ThemePreference,
  language: readLocal(LANG_KEY, "ru"),
  devModeUnlocked: readLocalBool(DEV_MODE_KEY, false),

  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },

  setLanguage: (language) => {
    localStorage.setItem(LANG_KEY, language);
    set({ language });
  },

  setDevModeUnlocked: (devModeUnlocked) => {
    localStorage.setItem(DEV_MODE_KEY, String(devModeUnlocked));
    set({ devModeUnlocked });
  },
}));
