import { Home, Bot, Radio, Puzzle, Clock, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { TopBar } from "./TopBar";

export function ConsoleLayout() {
  const { t } = useTranslation("layout");
  const location = useLocation();
  const navigate = useNavigate();

  const sidebarNavItems = [
    { path: "/dashboard", labelKey: "consoleNav.dashboard", icon: Home },
    { path: "/agents", labelKey: "consoleNav.agents", icon: Bot },
    { path: "/channels", labelKey: "consoleNav.channels", icon: Radio },
    { path: "/skills", labelKey: "consoleNav.skills", icon: Puzzle },
    { path: "/cron", labelKey: "consoleNav.cron", icon: Clock },
    { path: "/settings", labelKey: "consoleNav.settings", icon: Settings },
  ] as const;

  return (
    <div className="flex h-screen w-screen flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <nav className="flex w-52 shrink-0 flex-col border-r border-gray-200 bg-white py-3 dark:border-gray-700 dark:bg-gray-900">
          {sidebarNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`mx-2 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
