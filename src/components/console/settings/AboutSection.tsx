import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useConfigStore } from "@/store/console-stores/config-store";

export function AboutSection() {
  const { t } = useTranslation("console");
  const status = useConfigStore((s) => s.status);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
        {t("settings.about.title")}
      </h3>

      <div className="space-y-3">
        <div className="text-center py-2">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("settings.about.appName")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("settings.about.tagline")}</p>
          {status?.version && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {t("settings.about.version")}: {status.version}
            </p>
          )}
        </div>

        <div className="flex justify-center gap-4 pt-2">
          <a
            href="https://docs.openclaw.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("settings.about.docs")}
          </a>
          <a
            href="https://github.com/openclaw/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("settings.about.github")}
          </a>
        </div>
      </div>
    </div>
  );
}
