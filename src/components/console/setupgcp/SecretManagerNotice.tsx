import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SecretManagerNotice() {
  const { t } = useTranslation("console");
  return (
    <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">{t("setupGcp.secretsNotice.title")}</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-800/90 dark:text-blue-300/90">
          {t("setupGcp.secretsNotice.body")}
        </p>
      </div>
    </div>
  );
}
