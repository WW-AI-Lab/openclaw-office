import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ConsoleLayout } from "@/components/layout/ConsoleLayout";
import { FloorPlan } from "@/components/office-2d/FloorPlan";
import { AgentsPage } from "@/components/pages/AgentsPage";
import { ChannelsPage } from "@/components/pages/ChannelsPage";
import { CronPage } from "@/components/pages/CronPage";
import { DashboardPage } from "@/components/pages/DashboardPage";
import { ChatPage } from "@/components/pages/ChatPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { SetupGcpPage } from "@/components/pages/SetupGcpPage";
import { SkillsPage } from "@/components/pages/SkillsPage";
import { ChatWorkspaceBootstrap } from "@/components/chat/ChatWorkspaceBootstrap";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import type { PageId } from "@/gateway/types";
import { useGatewayConnection } from "@/hooks/useGatewayConnection";
import { useResponsive } from "@/hooks/useResponsive";
import { useOfficeStore } from "@/store/office-store";

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
  "/chat": "chat",
  "/dashboard": "dashboard",
  "/agents": "agents",
  "/channels": "channels",
  "/skills": "skills",
  "/cron": "cron",
  "/setup-gcp": "setupGcp",
  "/settings": "settings",
};

function resolveGatewayWsUrl(pathOrUrl: string, fallbackUrl: string): string {
  const value = (pathOrUrl || "").trim();
  if (value.startsWith("ws://") || value.startsWith("wss://")) {
    return value;
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    const url = new URL(value);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  }
  if (value.startsWith("/")) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${value}`;
  }
  return fallbackUrl;
}

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
    | { gatewayUrl?: string; gatewayToken?: string; gatewayWsPath?: string }
    | undefined;
  const configuredGatewayUrl = injected?.gatewayUrl || import.meta.env.VITE_GATEWAY_URL || "ws://localhost:18789";
  const configuredGatewayWsPath =
    injected?.gatewayWsPath || import.meta.env.VITE_GATEWAY_WS_PATH || configuredGatewayUrl;
  const gatewayUrl = resolveGatewayWsUrl(
    configuredGatewayWsPath,
    configuredGatewayUrl,
  );
  const gatewayToken = injected?.gatewayToken || import.meta.env.VITE_GATEWAY_TOKEN || "";
  const { isMobile } = useResponsive();
  const { wsClient } = useGatewayConnection({ url: gatewayUrl, token: gatewayToken });

  // DEV-only: 暴露手动会议 API 到浏览器控制台以便调试
  useEffect(() => {
    if (import.meta.env.DEV) {
      const win = window as unknown as Record<string, unknown>;
      win.__requestMeeting = (agentIds: string[]) =>
        useOfficeStore.getState().requestMeeting(agentIds);
      win.__dismissMeeting = (agentIds?: string[]) =>
        useOfficeStore.getState().dismissMeeting(agentIds);
    }
  }, []);

  return (
    <>
      <ThemeSync />
      <PageTracker />
      <ChatWorkspaceBootstrap wsClient={wsClient} />
      <Routes>
        <Route path="/" element={<AppShell isMobile={isMobile}><FloorPlan /></AppShell>} />
        <Route element={<ConsoleLayout />}>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/cron" element={<CronPage />} />
          <Route
            path="/setup-gcp"
            element={
              <ErrorBoundary title="Setup GCP">
                <SetupGcpPage />
              </ErrorBoundary>
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
