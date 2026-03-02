import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChannelsStore } from "@/store/console-stores/channels-store";

interface WhatsAppQrFlowProps {
  onClose: () => void;
}

export function WhatsAppQrFlow({ onClose }: WhatsAppQrFlowProps) {
  const { t } = useTranslation("console");
  const { qrState, qrDataUrl, qrError, startQrPairing, cancelQrPairing } = useChannelsStore();

  if (qrState === "idle" || qrState === "cancel") {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("channels.qr.description")}</p>
        <button
          type="button"
          onClick={startQrPairing}
          className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
        >
          {t("channels.qr.startPairing")}
        </button>
      </div>
    );
  }

  if (qrState === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        <p className="text-sm text-gray-500">{t("channels.qr.loading")}</p>
      </div>
    );
  }

  if (qrState === "qr" || qrState === "scanning") {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="WhatsApp QR Code"
            className="h-48 w-48 rounded-lg border border-gray-200 dark:border-gray-700"
          />
        )}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {qrState === "scanning" ? t("channels.qr.waitingScan") : t("channels.qr.scanPrompt")}
        </p>
        {qrState === "scanning" && <Loader2 className="h-5 w-5 animate-spin text-green-500" />}
        <button
          type="button"
          onClick={cancelQrPairing}
          className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          {t("common:actions.cancel")}
        </button>
      </div>
    );
  }

  if (qrState === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <CheckCircle className="h-10 w-10 text-green-500" />
        <p className="font-medium text-green-600">{t("channels.qr.success")}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
        >
          {t("common:actions.close")}
        </button>
      </div>
    );
  }

  // error state
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <XCircle className="h-10 w-10 text-red-500" />
      <p className="text-sm text-red-600 dark:text-red-400">{qrError ?? t("channels.qr.error")}</p>
      <button
        type="button"
        onClick={startQrPairing}
        className="rounded-md border border-red-300 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
      >
        {t("common:actions.retry")}
      </button>
    </div>
  );
}
