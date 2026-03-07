import { useTranslation } from "react-i18next";

const LANGS = [
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
  { code: "zh", label: "中文" },
] as const;

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation("layout");

  const currentIdx = LANGS.findIndex((l) => i18n.language?.startsWith(l.code));
  const idx = currentIdx >= 0 ? currentIdx : 0;
  const current = LANGS[idx];
  const next = LANGS[(idx + 1) % LANGS.length];

  const ariaLabel = t("topbar.language.switch", {
    lang: next.label,
    defaultValue: `Switch language to ${next.label}`,
  });

  const handleSwitch = () => {
    i18n.changeLanguage(next.code);
  };

  return (
    <button
      onClick={handleSwitch}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="ml-1 flex h-8 min-w-10 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
    >
      {current.label}
    </button>
  );
}
