import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AboutSection } from "@/components/console/settings/AboutSection";
import { AdvancedSection } from "@/components/console/settings/AdvancedSection";
import { AppearanceSection } from "@/components/console/settings/AppearanceSection";
import { DeveloperSection } from "@/components/console/settings/DeveloperSection";
import { GatewaySection } from "@/components/console/settings/GatewaySection";
import { ProvidersSection } from "@/components/console/settings/ProvidersSection";
import { UpdateSection } from "@/components/console/settings/UpdateSection";
import { LoadingState } from "@/components/console/shared/LoadingState";
import { useConfigStore } from "@/store/console-stores/config-store";
import { useConsoleSettingsStore } from "@/store/console-stores/settings-store";

export function SettingsPage() {
  const { t } = useTranslation("console");
  const loading = useConfigStore((s) => s.loading);
  const fetchConfig = useConfigStore((s) => s.fetchConfig);
  const fetchStatus = useConfigStore((s) => s.fetchStatus);
  const devMode = useConsoleSettingsStore((s) => s.devModeUnlocked);

  useEffect(() => {
    void fetchConfig();
    void fetchStatus();
  }, [fetchConfig, fetchStatus]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t("settings.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("settings.description")}</p>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-4">
          <AppearanceSection />
          <ProvidersSection />
          <GatewaySection />
          <UpdateSection />
          <AdvancedSection />
          {devMode && <DeveloperSection />}
          <AboutSection />
        </div>
      )}
    </div>
  );
}
