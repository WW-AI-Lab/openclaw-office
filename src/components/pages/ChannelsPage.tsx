import { RefreshCw, Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AvailableChannelGrid } from "@/components/console/channels/AvailableChannelGrid";
import { ChannelCard } from "@/components/console/channels/ChannelCard";
import { ChannelConfigDialog } from "@/components/console/channels/ChannelConfigDialog";
import { ChannelStatsBar } from "@/components/console/channels/ChannelStatsBar";
import { ConfirmDialog } from "@/components/console/shared/ConfirmDialog";
import { EmptyState } from "@/components/console/shared/EmptyState";
import { ErrorState } from "@/components/console/shared/ErrorState";
import { LoadingState } from "@/components/console/shared/LoadingState";
import type { ChannelInfo, ChannelType } from "@/gateway/adapter-types";
import { useChannelsStore } from "@/store/console-stores/channels-store";

export function ChannelsPage() {
  const { t } = useTranslation("console");
  const {
    channels,
    isLoading,
    error,
    fetchChannels,
    logoutChannel,
    configDialogOpen,
    configDialogChannelType,
    openConfigDialog,
    closeConfigDialog,
  } = useChannelsStore();

  const [logoutTarget, setLogoutTarget] = useState<ChannelInfo | null>(null);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const handleLogoutConfirm = async () => {
    if (logoutTarget) {
      await logoutChannel(logoutTarget.type, logoutTarget.accountId);
      setLogoutTarget(null);
    }
  };

  if (isLoading && channels.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("channels.title")}
          description={t("channels.description")}
          onRefresh={fetchChannels}
        />
        <LoadingState />
      </div>
    );
  }

  if (error && channels.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("channels.title")}
          description={t("channels.description")}
          onRefresh={fetchChannels}
        />
        <ErrorState message={error} onRetry={fetchChannels} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("channels.title")}
        description={t("channels.description")}
        onRefresh={fetchChannels}
        loading={isLoading}
      />
      <ChannelStatsBar channels={channels} />

      {channels.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t("channels.empty.title")}
          description={t("channels.empty.description")}
        />
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => (
            <ChannelCard
              key={ch.id}
              channel={ch}
              onLogout={setLogoutTarget}
              onDetail={(c) => openConfigDialog(c.type, c)}
            />
          ))}
        </div>
      )}

      <AvailableChannelGrid
        channels={channels}
        onSelect={(type: ChannelType) => openConfigDialog(type)}
      />

      <ChannelConfigDialog
        open={configDialogOpen}
        channelType={configDialogChannelType}
        onClose={closeConfigDialog}
      />

      <ConfirmDialog
        open={logoutTarget !== null}
        title={t("channels.logout.title")}
        description={t("channels.logout.description", { name: logoutTarget?.name ?? "" })}
        onConfirm={handleLogoutConfirm}
        onCancel={() => setLogoutTarget(null)}
        variant="danger"
      />
    </div>
  );
}

function PageHeader({
  title,
  description,
  onRefresh,
  loading,
}: {
  title: string;
  description: string;
  onRefresh: () => void;
  loading?: boolean;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        {t("actions.refresh")}
      </button>
    </div>
  );
}
