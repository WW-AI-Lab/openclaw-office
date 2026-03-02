import { Sun, Moon, Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useConsoleSettingsStore } from "@/store/console-stores/settings-store";
import { useOfficeStore } from "@/store/office-store";

type ThemePreference = "light" | "dark" | "system";

const THEME_OPTIONS: Array<{ value: ThemePreference; icon: typeof Sun; labelKey: string }> = [
  { value: "light", icon: Sun, labelKey: "settings.appearance.themeLight" },
  { value: "dark", icon: Moon, labelKey: "settings.appearance.themeDark" },
  { value: "system", icon: Monitor, labelKey: "settings.appearance.themeSystem" },
];

const LANG_OPTIONS = [
  { value: "zh", labelKey: "settings.appearance.langZh" },
  { value: "en", labelKey: "settings.appearance.langEn" },
];

function resolveSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AppearanceSection() {
  const { t, i18n } = useTranslation("console");
  const theme = useConsoleSettingsStore((s) => s.theme);
  const setThemePref = useConsoleSettingsStore((s) => s.setTheme);
  const setOfficeTheme = useOfficeStore((s) => s.setTheme);

  const handleThemeChange = (pref: ThemePreference) => {
    setThemePref(pref);
    const resolved = pref === "system" ? resolveSystemTheme() : pref;
    setOfficeTheme(resolved);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
        {t("settings.appearance.title")}
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t("settings.appearance.theme")}
          </span>
          <div className="flex gap-1 rounded-lg border border-gray-200 p-1 dark:border-gray-600">
            {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleThemeChange(value)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  theme === value
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t("settings.appearance.language")}
          </span>
          <div className="flex gap-1 rounded-lg border border-gray-200 p-1 dark:border-gray-600">
            {LANG_OPTIONS.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => i18n.changeLanguage(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  i18n.language === value
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
