import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation("layout");

  const isZh = i18n.language?.startsWith("zh");
  const label = isZh ? "中文" : "EN";
  const ariaLabel = isZh ? t("topbar.language.switchToEn") : t("topbar.language.switchToZh");

  const handleSwitch = () => {
    i18n.changeLanguage(isZh ? "en" : "zh");
  };

  return (
    <button
      onClick={handleSwitch}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
    >
      {label}
    </button>
  );
}
