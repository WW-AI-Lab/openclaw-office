import { AlertTriangle, XCircle } from "lucide-react";

interface AlertBannerProps {
  variant: "warning" | "error";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const VARIANT_STYLES = {
  warning:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  error:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300",
};

export function AlertBanner({ variant, message, actionLabel, onAction }: AlertBannerProps) {
  const Icon = variant === "warning" ? AlertTriangle : XCircle;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${VARIANT_STYLES[variant]}`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-xs font-medium underline hover:no-underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
