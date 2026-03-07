import { CheckCircle, Copy, Loader2, RefreshCw, Terminal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOfficeStore } from "@/store/office-store";
import { useConfigStore, type ConfigLifecycleStatus } from "@/store/console-stores/config-store";

const AUTO_CLEAR_MS = 2500;

export function RestartBanner() {
  const { t } = useTranslation("console");
  const lifecycleState = useConfigStore((s) => s.lifecycleState);
  const clearLifecycle = useConfigStore((s) => s.clearLifecycle);
  const setLifecycleDisconnected = useConfigStore((s) => s.setLifecycleDisconnected);
  const setLifecycleReconnecting = useConfigStore((s) => s.setLifecycleReconnecting);
  const setLifecycleComplete = useConfigStore((s) => s.setLifecycleComplete);
  const connectionStatus = useOfficeStore((s) => s.connectionStatus);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!lifecycleState?.estimatedDelayMs) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        lifecycleState.estimatedDelayMs! - (Date.now() - lifecycleState.startedAt),
      );
      setCountdown(Math.ceil(remaining / 1000));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lifecycleState]);

  useEffect(() => {
    if (!lifecycleState) return;
    if (lifecycleState.status === "apply-restarting") {
      if (connectionStatus === "disconnected" || connectionStatus === "error") {
        setLifecycleDisconnected();
      } else if (connectionStatus === "connecting" || connectionStatus === "reconnecting") {
        setLifecycleReconnecting();
      } else if (connectionStatus === "connected") {
        setLifecycleComplete();
      }
      return;
    }

    if (lifecycleState.status === "disconnected" || lifecycleState.status === "reconnecting") {
      if (connectionStatus === "connected") {
        setLifecycleComplete();
      } else if (
        (connectionStatus === "connecting" || connectionStatus === "reconnecting") &&
        lifecycleState.status !== "reconnecting"
      ) {
        setLifecycleReconnecting();
      } else if (
        (connectionStatus === "disconnected" || connectionStatus === "error") &&
        lifecycleState.status !== "disconnected"
      ) {
        setLifecycleDisconnected();
      }
    }
  }, [
    connectionStatus,
    lifecycleState,
    setLifecycleComplete,
    setLifecycleDisconnected,
    setLifecycleReconnecting,
  ]);

  useEffect(() => {
    if (!lifecycleState) return;
    if (
      lifecycleState.status === "complete" ||
      lifecycleState.status === "effective-now" ||
      lifecycleState.status === "saved-hot-reload"
    ) {
      const timer = setTimeout(() => clearLifecycle(), AUTO_CLEAR_MS);
      return () => clearTimeout(timer);
    }
  }, [clearLifecycle, lifecycleState]);

  const presentation = useMemo(() => {
    if (!lifecycleState) return null;

    const messageKey = lifecycleState.messageKey ?? statusToMessageKey(lifecycleState.status);
    const message =
      lifecycleState.status === "apply-restarting"
        ? t(messageKey, { seconds: countdown ?? 0 })
        : t(messageKey);

    switch (lifecycleState.status) {
      case "effective-now":
      case "saved-hot-reload":
      case "complete":
        return {
          icon: CheckCircle,
          className:
            "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300",
          message,
          animate: "",
        };
      case "saved-restart-required":
      case "saved-cli-restart-required":
        return {
          icon: RefreshCw,
          className:
            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
          message,
          animate: "",
        };
      case "apply-restarting":
      case "disconnected":
      case "reconnecting":
        return {
          icon: Loader2,
          className:
            "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
          message,
          animate: "animate-spin",
        };
      default:
        return null;
    }
  }, [countdown, lifecycleState, t]);

  if (!lifecycleState || !presentation) return null;

  const Icon = presentation.icon;
  const showCommand = Boolean(lifecycleState.command);

  const handleCopy = async () => {
    if (!lifecycleState.command || !navigator.clipboard) return;
    await navigator.clipboard.writeText(lifecycleState.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`border-b px-4 py-3 text-sm ${presentation.className}`}>
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${presentation.animate}`} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{presentation.message}</p>
          {showCommand && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-md border border-current/20 bg-black/5 px-3 py-1.5 font-mono text-xs dark:bg-white/5">
                <Terminal className="h-3.5 w-3.5" />
                {lifecycleState.command}
              </div>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1 rounded-md border border-current/20 px-2.5 py-1 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? t("configLifecycle.copiedCommand") : t("configLifecycle.copyCommand")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function statusToMessageKey(status: ConfigLifecycleStatus): string {
  switch (status) {
    case "effective-now":
      return "configLifecycle.effectiveNow";
    case "saved-hot-reload":
      return "configLifecycle.savedHotReload";
    case "saved-restart-required":
      return "configLifecycle.savedRestartRequired";
    case "saved-cli-restart-required":
      return "configLifecycle.savedCliRestartRequired";
    case "apply-restarting":
      return "configLifecycle.applyRestarting";
    case "disconnected":
      return "configLifecycle.disconnected";
    case "reconnecting":
      return "configLifecycle.reconnecting";
    case "complete":
      return "configLifecycle.complete";
  }
}
