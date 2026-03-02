import { Radio, Wrench, Clock, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  {
    path: "/channels",
    icon: Radio,
    titleKey: "console:channels.title",
    descKey: "console:channels.description",
  },
  {
    path: "/skills",
    icon: Wrench,
    titleKey: "console:skills.title",
    descKey: "console:skills.description",
  },
  {
    path: "/cron",
    icon: Clock,
    titleKey: "console:cron.title",
    descKey: "console:cron.description",
  },
  {
    path: "/settings",
    icon: Settings,
    titleKey: "console:settings.title",
    descKey: "console:settings.description",
  },
];

export function QuickNavGrid() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.path}
          type="button"
          onClick={() => navigate(item.path)}
          className="flex flex-col items-start gap-2 rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600 dark:hover:bg-blue-900/10"
        >
          <item.icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t(item.titleKey)}
            </div>
            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
              {t(item.descKey)}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
