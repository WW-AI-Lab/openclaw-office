import { Loader2, CheckCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useConfigStore } from "@/store/console-stores/config-store";

export function RestartBanner() {
  const { t } = useTranslation("console");
  const restartState = useConfigStore((s) => s.restartState);
  const clearRestart = useConfigStore((s) => s.clearRestart);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!restartState || restartState.status !== "pending") {
      setCountdown(null);
      return;
    }
    const remaining = Math.max(
      0,
      restartState.estimatedDelayMs - (Date.now() - restartState.startedAt),
    );
    setCountdown(Math.ceil(remaining / 1000));

    const interval = setInterval(() => {
      const r = Math.max(0, restartState.estimatedDelayMs - (Date.now() - restartState.startedAt));
      setCountdown(Math.ceil(r / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [restartState]);

  useEffect(() => {
    if (restartState?.status === "complete") {
      const timer = setTimeout(() => clearRestart(), 2000);
      return () => clearTimeout(timer);
    }
  }, [restartState?.status, clearRestart]);

  if (!restartState) return null;

  const statusConfig = {
    pending: {
      icon: RefreshCw,
      text: t("restart.pending", { seconds: countdown ?? 0 }),
      color: "bg-yellow-500",
      animate: "",
    },
    disconnected: {
      icon: Loader2,
      text: t("restart.disconnected"),
      color: "bg-orange-500",
      animate: "animate-spin",
    },
    reconnecting: {
      icon: Loader2,
      text: t("restart.reconnecting"),
      color: "bg-blue-500",
      animate: "animate-spin",
    },
    complete: {
      icon: CheckCircle,
      text: t("restart.complete"),
      color: "bg-green-500",
      animate: "",
    },
  };

  const cfg = statusConfig[restartState.status];
  const Icon = cfg.icon;

  return (
    <div className={`${cfg.color} px-4 py-2 text-center text-sm font-medium text-white`}>
      <div className="flex items-center justify-center gap-2">
        <Icon className={`h-4 w-4 ${cfg.animate}`} />
        {cfg.text}
      </div>
    </div>
  );
}
