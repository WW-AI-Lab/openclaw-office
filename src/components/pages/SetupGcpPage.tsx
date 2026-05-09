import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChannelsAdminView } from "@/components/console/setupgcp/ChannelsAdminView";
import { OpenHandsAdminView } from "@/components/console/setupgcp/OpenHandsAdminView";
import { PairingRequestsView } from "@/components/console/setupgcp/PairingRequestsView";
import { SecretManagerNotice } from "@/components/console/setupgcp/SecretManagerNotice";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useSetupGcpStore } from "@/store/console-stores/setupgcp-store";

type Tab = "pairing" | "channels" | "openhands";

const DEFAULT_OPERATOR_ID = "console-admin";

export function SetupGcpPage() {
  const { t } = useTranslation("console");
  const refreshConfig = useSetupGcpStore((s) => s.refreshConfig);
  const configured = useSetupGcpStore((s) => s.configured);
  const baseUrl = useSetupGcpStore((s) => s.baseUrl);
  const [tab, setTab] = useState<Tab>("pairing");

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t("setupGcp.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("setupGcp.description")}</p>
        {configured && (
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            <span className="font-mono">{baseUrl}</span>
          </p>
        )}
      </div>

      <SecretManagerNotice />

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <TabButton active={tab === "pairing"} onClick={() => setTab("pairing")}>
          {t("setupGcp.tabs.pairing")}
        </TabButton>
        <TabButton active={tab === "channels"} onClick={() => setTab("channels")}>
          {t("setupGcp.tabs.channels")}
        </TabButton>
        <TabButton active={tab === "openhands"} onClick={() => setTab("openhands")}>
          {t("setupGcp.tabs.openhands")}
        </TabButton>
      </div>

      {/*
        Wrap the active tab in a local error boundary so an unexpected throw
        inside one of the tab views (e.g. a malformed sidecar payload) renders
        a friendly panel instead of unmounting the entire React tree and
        leaving the browser tab blank.
      */}
      <ErrorBoundary title={t("setupGcp.title")}>
        {tab === "pairing" ? (
          <PairingRequestsView defaultDecidedBy={DEFAULT_OPERATOR_ID} />
        ) : tab === "channels" ? (
          <ChannelsAdminView />
        ) : (
          <OpenHandsAdminView />
        )}
      </ErrorBoundary>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
          : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
