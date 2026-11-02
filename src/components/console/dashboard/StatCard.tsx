import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  subtitle?: string;
  progress?: number;
  color?: string;
}

export function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  progress,
  color = "text-blue-500",
}: StatCardProps) {
  // 动态计算颜色类
  const colorClasses: Record<string, string> = {
    'text-blue-500': 'from-blue-500/10 to-blue-500/5 border-blue-200 dark:border-blue-800',
    'text-green-500': 'from-green-500/10 to-green-500/5 border-green-200 dark:border-green-800',
    'text-amber-500': 'from-amber-500/10 to-amber-500/5 border-amber-200 dark:border-amber-800',
    'text-purple-500': 'from-purple-500/10 to-purple-500/5 border-purple-200 dark:border-purple-800',
    'text-red-500': 'from-red-500/10 to-red-500/5 border-red-200 dark:border-red-800',
    'text-cyan-500': 'from-cyan-500/10 to-cyan-500/5 border-cyan-200 dark:border-cyan-800',
  };

  const gradientClass = colorClasses[color] || colorClasses['text-blue-500'];

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${gradientClass} p-5 transition-all duration-200 hover:shadow-lg dark:bg-gray-800/50 card-hover`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg bg-white/80 p-2 dark:bg-gray-900/50 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</span>
        </div>
      </div>
      <div className="mt-3 text-3xl font-bold text-gray-900 dark:text-gray-100 number-pop">{value}</div>
      {subtitle && (
        <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">{subtitle}</p>
      )}
      {progress != null && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200/50 dark:bg-gray-700/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
