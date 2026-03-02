import { useTranslation } from "react-i18next";

export function ChannelsTab() {
  const { t } = useTranslation("console");

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {t("agents.channels.title")}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{t("agents.channels.noBindings")}</p>
    </div>
  );
}
