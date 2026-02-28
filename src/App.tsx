import { lazy, Suspense, useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { ConsoleLayout } from "@/components/layout/ConsoleLayout";
import { FloorPlan } from "@/components/office-2d/FloorPlan";
import { DashboardPage } from "@/components/pages/DashboardPage";
import { ChannelsPage } from "@/components/pages/ChannelsPage";
import { SkillsPage } from "@/components/pages/SkillsPage";
import { CronPage } from "@/components/pages/CronPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { AgentsPage } from "@/components/pages/AgentsPage";
import { useGatewayConnection } from "@/hooks/useGatewayConnection";
import { useResponsive } from "@/hooks/useResponsive";
import { useOfficeStore } from "@/store/office-store";
import type { PageId } from "@/gateway/types";

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
  const injected = (window as unknown as Record<string, unknown>).__OPENCLAW_CONFIG__ as
    | { gatewayUrl?: string; gatewayToken?: string }
    | undefined;
  const gatewayUrl = injected?.gatewayUrl || import.meta.env.VITE_GATEWAY_URL || "ws://localhost:18789";
  const gatewayToken = injected?.gatewayToken || import.meta.env.VITE_GATEWAY_TOKEN || "";
  const { isMobile } = useResponsive();
  const setViewMode = useOfficeStore((s) => s.setViewMode);

  const { wsClient } = useGatewayConnection({ url: gatewayUrl, token: gatewayToken });

  useEffect(() => {
    if (isMobile) {
      setViewMode("2d");
    }
  }, [isMobile, setViewMode]);

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
