import { lazy, Suspense, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ConsoleLayout } from "@/components/layout/ConsoleLayout";
import { FloorPlan } from "@/components/office-2d/FloorPlan";
import { AgentsPage } from "@/components/pages/AgentsPage";
import { ChannelsPage } from "@/components/pages/ChannelsPage";
import { CronPage } from "@/components/pages/CronPage";
import { DashboardPage } from "@/components/pages/DashboardPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { SkillsPage } from "@/components/pages/SkillsPage";
import { ConnectionSetupDialog } from "@/components/shared/ConnectionSetupDialog";
import type { PageId } from "@/gateway/types";
import { useGatewayConnection } from "@/hooks/useGatewayConnection";
import type { ConnectionPreference } from "@/lib/connection-preferences";
import { readConnectionPreference, writeConnectionPreference } from "@/lib/connection-preferences";
import { resolveGatewayConnectionConfig } from "@/lib/gateway-url";
import { updateRuntimeConnectionTarget } from "@/lib/runtime-connection-api";
import { useResponsive } from "@/hooks/useResponsive";
import { useOfficeStore } from "@/store/office-store";

const Scene3D = lazy(() => import("@/components/office-3d/Scene3D"));

function Scene3DFallback() {
  const { t } = useTranslation("office");
  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span className="text-sm text-gray-500 dark:text-gray-400">{t("loading3D")}</span>
      </div>
    </div>
  );
}

function OfficeView() {
  const viewMode = useOfficeStore((s) => s.viewMode);
  const [fading, setFading] = useState(false);
  const [displayMode, setDisplayMode] = useState(viewMode);

  useEffect(() => {
    if (viewMode !== displayMode) {
      setFading(true);
      const timer = setTimeout(() => {
        setDisplayMode(viewMode);
        setFading(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [viewMode, displayMode]);

  return (
    <div
      className="h-full w-full transition-opacity duration-300"
      style={{ opacity: fading ? 0 : 1 }}
    >
      {displayMode === "2d" ? (
        <FloorPlan />
      ) : (
        <Suspense fallback={<Scene3DFallback />}>
          <Scene3D />
        </Suspense>
      )}
    </div>
  );
}

function ThemeSync() {
  const theme = useOfficeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  return null;
}

function ConnectionBootstrap({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e0f2fe,transparent_35%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-6 dark:bg-[radial-gradient(circle_at_top,#082f49,transparent_35%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]">
      <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-white/60 bg-white/80 px-8 py-10 text-center shadow-2xl backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/80">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{message}</p>
      </div>
    </div>
  );
}

const PAGE_MAP: Record<string, PageId> = {
  "/": "office",
  "/dashboard": "dashboard",
  "/agents": "agents",
  "/channels": "channels",
  "/skills": "skills",
  "/cron": "cron",
  "/settings": "settings",
};

function PageTracker() {
  const location = useLocation();
  const setCurrentPage = useOfficeStore((s) => s.setCurrentPage);

  useEffect(() => {
    const page = PAGE_MAP[location.pathname] ?? "office";
    setCurrentPage(page);
  }, [location.pathname, setCurrentPage]);

  return null;
}

export function App() {
  const { t } = useTranslation("common");
  const injected = (window as unknown as Record<string, unknown>).__OPENCLAW_CONFIG__ as
    | { gatewayUrl?: string; gatewayToken?: string }
    | undefined;
  const proxyGatewayUrl = injected?.gatewayUrl || "/gateway-ws";
  const managedGatewayToken = injected?.gatewayToken || import.meta.env.VITE_GATEWAY_TOKEN || "";
  const defaultConnectionPreference: ConnectionPreference | null = managedGatewayToken
    ? {
        mode: "local",
        gatewayUrl: proxyGatewayUrl,
        gatewayToken: managedGatewayToken,
      }
    : null;
  const [connectionPreference, setConnectionPreference] = useState<ConnectionPreference | null>(
    () => readConnectionPreference() || defaultConnectionPreference,
  );
  const [isApplyingConnection, setIsApplyingConnection] = useState(false);
  const [connectionSetupError, setConnectionSetupError] = useState<string | null>(null);
  const [connectionReady, setConnectionReady] = useState(() => connectionPreference !== null);
  const { isMobile } = useResponsive();
  const setViewMode = useOfficeStore((s) => s.setViewMode);

  useEffect(() => {
    if (!connectionPreference && defaultConnectionPreference) {
      writeConnectionPreference(defaultConnectionPreference);
      setConnectionPreference(defaultConnectionPreference);
      return;
    }

    if (!connectionPreference) {
      setConnectionReady(false);
      return;
    }

    const preference = connectionPreference;
    const shouldConfigureRuntimeProxy = proxyGatewayUrl.startsWith("/");

    // For local mode, the WS proxy path is always the same — no need to
    // interrupt the connection while we sync the runtime proxy target.
    if (!shouldConfigureRuntimeProxy) {
      setConnectionReady(true);
      return;
    }

    // Remote mode or first-time local sync: update the runtime proxy target
    // but keep the connection alive (the proxy handles it transparently).
    setConnectionReady(true);

    let cancelled = false;
    async function syncConnectionTarget() {
      setConnectionSetupError(null);
      try {
        if (preference.mode === "remote") {
          await updateRuntimeConnectionTarget({
            mode: "remote",
            gatewayUrl: preference.gatewayUrl,
          });
        } else {
          await updateRuntimeConnectionTarget({ mode: "local" });
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : t("errors.unknownError");
          setConnectionSetupError(message);
        }
      }
    }

    void syncConnectionTarget();

    return () => {
      cancelled = true;
    };
  }, [connectionPreference, defaultConnectionPreference, proxyGatewayUrl, t]);

  const browserGatewayToken =
    connectionPreference?.mode === "remote" ? connectionPreference.gatewayToken : managedGatewayToken;
  const gatewayConnection = resolveGatewayConnectionConfig(
    proxyGatewayUrl,
    browserGatewayToken,
    window.location,
    { preferSameOriginProxy: import.meta.env.DEV && !injected?.gatewayUrl },
  );

  const { wsClient } = useGatewayConnection({
    url: connectionReady ? gatewayConnection.url : "",
    token: connectionReady ? gatewayConnection.token : "",
  });

  useEffect(() => {
    if (isMobile) {
      setViewMode("2d");
    }
  }, [isMobile, setViewMode]);

  const handleConnectionSetup = async (preference: ConnectionPreference) => {
    setIsApplyingConnection(true);
    setConnectionSetupError(null);

    try {
      if (preference.mode === "remote") {
        await updateRuntimeConnectionTarget({
          mode: "remote",
          gatewayUrl: preference.gatewayUrl,
        });
      } else {
        await updateRuntimeConnectionTarget({ mode: "local" });
      }

      writeConnectionPreference(preference);
      setConnectionPreference(preference);
      setConnectionReady(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("errors.unknownError");
      setConnectionSetupError(message);
    } finally {
      setIsApplyingConnection(false);
    }
  };

  if (!connectionPreference || connectionSetupError) {
    return (
      <>
        <ThemeSync />
        <ConnectionSetupDialog
          initialPreference={connectionPreference}
          onSubmit={handleConnectionSetup}
          submitting={isApplyingConnection}
          error={connectionSetupError}
        />
      </>
    );
  }

  if (!connectionReady) {
    return (
      <>
        <ThemeSync />
        <ConnectionBootstrap message={t("connectionSetup.syncing")} />
      </>
    );
  }

  return (
    <>
      <ThemeSync />
      <PageTracker />
      <Routes>
        <Route element={<AppShell wsClient={wsClient} isMobile={isMobile} />}>
          <Route path="/" element={<OfficeView />} />
        </Route>
        <Route element={<ConsoleLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/cron" element={<CronPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
