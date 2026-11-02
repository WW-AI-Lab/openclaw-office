import { Radio, Wrench, Clock, Settings, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  {
    path: "/channels",
    icon: Radio,
    titleKey: "console:channels.title",
    descKey: "console:channels.description",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    path: "/skills",
    icon: Wrench,
    titleKey: "console:skills.title",
    descKey: "console:skills.description",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    path: "/cron",
    icon: Clock,
    titleKey: "console:cron.title",
    descKey: "console:cron.description",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    path: "/settings",
    icon: Settings,
    titleKey: "console:settings.title",
    descKey: "console:settings.description",
    gradient: "from-green-500 to-emerald-500",
  },
];

export function QuickNavGrid() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.path}
          type="button"
          onClick={() => navigate(item.path)}
          className="group relative overflow-hidden rounded-xl border border-gray-200/50 bg-white p-5 text-left transition-all duration-300 hover:border-transparent hover:shadow-xl dark:border-gray-700/50 dark:bg-gray-800/50"
        >
          {/* 渐变背景 - 悬停时显示 */}
          <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
          
          {/* 内容 */}
          <div className="relative z-10">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100/80 text-gray-600 transition-all duration-300 group-hover:bg-white/30 group-hover:text-white dark:bg-gray-700/50 dark:text-gray-300">
              <item.icon className="h-5 w-5" />
            </div>
            <div className="text-base font-semibold text-gray-900 transition-colors duration-300 group-hover:text-white dark:text-gray-100">
              {t(item.titleKey)}
            </div>
            <div className="mt-1 text-xs font-medium text-gray-500 transition-colors duration-300 group-hover:text-white/80 dark:text-gray-400">
              {t(item.descKey)}
            </div>
          </div>
          
          {/* 箭头 - 悬停时显示 */}
          <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-gray-400 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}
