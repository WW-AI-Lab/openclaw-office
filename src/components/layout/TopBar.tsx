import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { isMockMode } from "@/gateway/adapter-provider";
import type { ConnectionStatus, ThemeMode, PageId } from "@/gateway/types";
import { useAuthStore } from "@/store/auth-store";
import { useOfficeStore } from "@/store/office-store";

const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

function getStatusConfig(
  t: (key: string) => string,
): Record<ConnectionStatus, { color: string; pulse: boolean; label: string }> {
  return {
    connecting: { color: "#eab308", pulse: true, label: t("common:status.connecting") },
    connected: { color: "#22c55e", pulse: false, label: t("common:status.connected") },
    reconnecting: { color: "#f97316", pulse: true, label: t("common:status.reconnecting") },
    disconnected: { color: "#6b7280", pulse: false, label: t("common:status.disconnected") },
    error: { color: "#ef4444", pulse: false, label: t("common:status.error") },
  };
}

interface TopBarProps {
  isMobile?: boolean;
}

export function TopBar({ isMobile = false }: TopBarProps) {
  const { t } = useTranslation("layout");
  const connectionStatus = useOfficeStore((s) => s.connectionStatus);
  const connectionError = useOfficeStore((s) => s.connectionError);
  const metrics = useOfficeStore((s) => s.globalMetrics);
  const theme = useOfficeStore((s) => s.theme);
  const setTheme = useOfficeStore((s) => s.setTheme);
  const currentPage = useOfficeStore((s) => s.currentPage);

  const statusCfg = getStatusConfig(t)[connectionStatus];
  const isOfficePage = currentPage === "office";

  return (
    <header className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-gray-200/80 bg-white px-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="min-w-0">
        <BrandSection metrics={metrics} isOfficePage={isOfficePage} isMobile={isMobile} />
      </div>
      <TopNav currentPage={currentPage} />
      <div className="ml-auto flex items-center gap-3 justify-self-end">
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <LanguageSwitcher />
        <ConnectionIndicator
          statusCfg={statusCfg}
          connectionError={connectionError}
          connectionStatus={connectionStatus}
        />
        <LogoutButton />
      </div>
    </header>
  );
}

function BrandSection({
  metrics,
  isOfficePage,
  isMobile,
}: {
  metrics: { activeAgents: number; totalAgents: number; totalTokens: number };
  isOfficePage: boolean;
  isMobile?: boolean;
}) {
  const { t } = useTranslation("layout");

  return (
    <div className="flex min-w-0 items-center gap-3">
      <h1 className="truncate text-sm font-semibold tracking-tight text-gray-800 dark:text-gray-100">
        OpenClaw Office
      </h1>
      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] tabular-nums text-gray-400 dark:bg-gray-800 dark:text-gray-500">
        v{APP_VERSION}
      </span>
      {isOfficePage && !isMobile && (
        <div className="ml-2 hidden items-center gap-5 text-xs text-gray-400 dark:text-gray-500 xl:flex">
          <span>
            {t("topbar.activeCountText")}{" "}
            <strong className="text-gray-700 dark:text-gray-300">
              {metrics.activeAgents}/{metrics.totalAgents}
            </strong>
          </span>
          <span>
            {t("topbar.tokensLabel")}{" "}
            <strong className="text-gray-700 dark:text-gray-300">
              {formatTokens(metrics.totalTokens)}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}

function TopNav({ currentPage }: { currentPage: PageId }) {
  const { t } = useTranslation("layout");
  const navigate = useNavigate();
  const isOfficePage = currentPage === "office";
  const isChatPage = currentPage === "chat";
  const isWorkbenchPage = currentPage === "skill-workbench";
  const isConsolePage = !isOfficePage && !isChatPage && !isWorkbenchPage;

  const items: { active: boolean; label: string; onClick: () => void }[] = [
    { active: isOfficePage, label: t("topbar.office"), onClick: () => navigate("/") },
    { active: isChatPage, label: t("topbar.chat"), onClick: () => navigate("/chat") },
    { active: isWorkbenchPage, label: t("topbar.workbench"), onClick: () => navigate("/skill-workbench") },
    { active: isConsolePage, label: t("topbar.console"), onClick: () => navigate("/dashboard") },
  ];

  return (
    <nav aria-label={t("topbar.navigation")} className="flex items-center gap-1">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.onClick}
          className={`relative px-4 py-1 text-sm font-medium transition-colors ${
            item.active
              ? "text-gray-900 dark:text-gray-100"
              : "text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
          }`}
        >
          {item.label}
          {item.active && (
            <span className="absolute inset-x-1 -bottom-[9px] h-0.5 rounded-full bg-gray-900 dark:bg-gray-100" />
          )}
        </button>
      ))}
    </nav>
  );
}

function ConnectionIndicator({
  statusCfg,
  connectionError,
  connectionStatus,
}: {
  statusCfg: { color: string; pulse: boolean; label: string };
  connectionError: string | null;
  connectionStatus: ConnectionStatus;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: statusCfg.color,
          animation: statusCfg.pulse ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
      />
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {connectionError && connectionStatus === "error" ? connectionError : statusCfg.label}
      </span>
    </div>
  );
}

function LogoutButton() {
  const { t } = useTranslation("layout");
  const logout = useAuthStore((s) => s.logout);

  if (isMockMode()) {
    return null;
  }

  return (
    <button
      onClick={logout}
      title={t("topbar.logout")}
      aria-label={t("topbar.logout")}
      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}

function ThemeToggle({ theme, setTheme }: { theme: ThemeMode; setTheme: (t: ThemeMode) => void }) {
  const { t } = useTranslation("layout");

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      title={theme === "light" ? t("topbar.theme.switchToDark") : t("topbar.theme.switchToLight")}
      className="ml-2 flex h-7 w-7 items-center justify-center rounded-md text-base transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}
