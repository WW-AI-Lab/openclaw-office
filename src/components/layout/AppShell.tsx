import { useEffect, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import { ChatDialog } from "@/components/chat/ChatDialog";
import { ChatDockBar } from "@/components/chat/ChatDockBar";
import { RestartBanner } from "@/components/shared/RestartBanner";
import { ToastContainer } from "@/components/shared/ToastContainer";
import type { GatewayWsClient } from "@/gateway/ws-client";
import { useChatDockStore } from "@/store/console-stores/chat-dock-store";
import { useOfficeStore } from "@/store/office-store";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children?: ReactNode;
  wsClient?: RefObject<GatewayWsClient | null>;
  isMobile?: boolean;
}

export function AppShell({ children, wsClient, isMobile = false }: AppShellProps) {
  const { t } = useTranslation("layout");
  const sidebarCollapsed = useOfficeStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useOfficeStore((s) => s.setSidebarCollapsed);
  const initEventListeners = useChatDockStore((s) => s.initEventListeners);
  const setTargetAgent = useChatDockStore((s) => s.setTargetAgent);
  const connectionStatus = useOfficeStore((s) => s.connectionStatus);
  const agents = useOfficeStore((s) => s.agents);
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);

  const initEventHistory = useOfficeStore((s) => s.initEventHistory);

  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  }, [isMobile, setSidebarCollapsed]);

  // Restore event history from IndexedDB on mount
  useEffect(() => {
    initEventHistory();
  }, [initEventHistory]);

  // Init chat event listeners when connected
  useEffect(() => {
    if (connectionStatus !== "connected") return;
    const client = wsClient?.current ?? null;
    if (!client) return;
    const unsub = initEventListeners(client);
    return unsub;
  }, [connectionStatus, wsClient, initEventListeners]);

  // Set default target agent to main agent on connection
  useEffect(() => {
    if (connectionStatus === "connected" && agents.size > 0) {
      const currentTarget = useChatDockStore.getState().targetAgentId;
      if (!currentTarget) {
        const mainAgent = Array.from(agents.values()).find((a) => !a.isSubAgent);
        if (mainAgent) {
          setTargetAgent(mainAgent.id);
        }
      }
    }
  }, [connectionStatus, agents, setTargetAgent]);

  // Sync chat target when sidebar agent selection changes
  useEffect(() => {
    if (!selectedAgentId) return;
    const agent = agents.get(selectedAgentId);
    if (!agent || agent.isSubAgent) return;
    const currentTarget = useChatDockStore.getState().targetAgentId;
    if (currentTarget !== selectedAgentId) {
      setTargetAgent(selectedAgentId);
    }
  }, [selectedAgentId, agents, setTargetAgent]);

  const content = children ?? <Outlet />;

  return (
    <div className="flex h-screen w-screen flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <RestartBanner />
      <TopBar isMobile={isMobile} />
      <ToastContainer />
      <div className="relative flex flex-1 overflow-hidden">
        <main className="relative flex flex-1 flex-col overflow-hidden">
          <div className="relative flex-1 overflow-hidden">{content}</div>
          <ChatDialog />
          <ChatDockBar />
        </main>
        {isMobile ? (
          <>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="fixed bottom-0 left-1/2 z-20 flex h-10 w-full max-w-xs -translate-x-1/2 items-center justify-center border-t border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
              aria-label={
                sidebarCollapsed ? t("sidebar.expandSidebar") : t("sidebar.collapseSidebar")
              }
            >
              <div className="h-1 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />
            </button>
            {!sidebarCollapsed && (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSidebarCollapsed(true)}
                  onKeyDown={(e) => e.key === "Escape" && setSidebarCollapsed(true)}
                  className="fixed inset-0 z-30 bg-black/30"
                  aria-label={t("sidebar.closeSidebar")}
                />
                <aside className="fixed inset-x-0 bottom-10 top-12 z-40 overflow-hidden rounded-t-xl border-t border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                  <Sidebar />
                </aside>
              </>
            )}
          </>
        ) : (
          <Sidebar />
        )}
      </div>
    </div>
  );
}
