import { CheckCircle2, KeyRound, Plus, RefreshCw, Send, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/console/shared/ConfirmDialog";
import { EmptyState } from "@/components/console/shared/EmptyState";
import { ErrorState } from "@/components/console/shared/ErrorState";
import { LoadingState } from "@/components/console/shared/LoadingState";
import type { ChannelTestResult, NotificationChannel } from "@/lib/registry-api-client";
import { useSetupGcpStore } from "@/store/console-stores/setupgcp-store";

export function ChannelsAdminView() {
  const { t } = useTranslation("console");
  const rawItems = useSetupGcpStore((s) => s.channelItems);
  // Defensive coercion — see PairingRequestsView for rationale.
  const items = Array.isArray(rawItems) ? rawItems : [];
  const loading = useSetupGcpStore((s) => s.channelsLoading);
  const error = useSetupGcpStore((s) => s.channelsError);
  const inFlight = useSetupGcpStore((s) => s.channelActionInFlight);
  const lastTest = useSetupGcpStore((s) => s.lastChannelTest);
  const fetchChannels = useSetupGcpStore((s) => s.fetchChannels);
  const createChannel = useSetupGcpStore((s) => s.createChannel);
  const deleteChannel = useSetupGcpStore((s) => s.deleteChannel);
  const setSecret = useSetupGcpStore((s) => s.setChannelSecret);
  const updateChannel = useSetupGcpStore((s) => s.updateChannel);
  const testChannel = useSetupGcpStore((s) => s.testChannel);
  const configured = useSetupGcpStore((s) => s.configured);

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NotificationChannel | null>(null);

  useEffect(() => {
    if (configured) void fetchChannels();
  }, [configured, fetchChannels]);

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t("setupGcp.channels.title")}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("setupGcp.channels.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchChannels()}
            disabled={loading || !configured}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("setupGcp.actions.refresh")}
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!configured}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("setupGcp.actions.addChannel")}
          </button>
        </div>
      </div>

      {!configured ? (
        <NotConfiguredHint />
      ) : loading && items.length === 0 ? (
        <LoadingState />
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={() => fetchChannels()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Send}
          title={t("setupGcp.channels.empty.title")}
          description={t("setupGcp.channels.empty.description")}
          action={{ label: t("setupGcp.actions.addChannel"), onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((ch) => (
            <ChannelRow
              key={ch.id}
              channel={ch}
              busy={Boolean(inFlight[ch.id])}
              testResult={lastTest[ch.id] ?? null}
              onSetSecret={(secret) => setSecret(ch.id, secret)}
              onTest={(message) => testChannel(ch.id, message)}
              onToggle={(enabled) => updateChannel(ch.id, { enabled })}
              onDelete={() => setDeleteTarget(ch)}
            />
          ))}
        </ul>
      )}

      <CreateChannelDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (body, secretValue) => {
          const created = await createChannel(body);
          if (created && secretValue) {
            await setSecret(created.id, secretValue);
          }
          setCreateOpen(false);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("setupGcp.channels.deleteDialog.title")}
        description={t("setupGcp.channels.deleteDialog.description", {
          name: deleteTarget?.name ?? "",
        })}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await deleteChannel(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </section>
  );
}

function NotConfiguredHint() {
  const { t } = useTranslation("console");
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-medium">{t("setupGcp.notConfigured.title")}</p>
      <p className="mt-1 text-xs leading-relaxed">{t("setupGcp.notConfigured.body")}</p>
    </div>
  );
}

interface ChannelRowProps {
  channel: NotificationChannel;
  busy: boolean;
  testResult: ChannelTestResult | null;
  onSetSecret: (secret: string) => Promise<void> | void;
  onTest: (message?: string) => Promise<ChannelTestResult | null>;
  onToggle: (enabled: boolean) => Promise<void> | void;
  onDelete: () => void;
}

function ChannelRow({
  channel,
  busy,
  testResult,
  onSetSecret,
  onTest,
  onToggle,
  onDelete,
}: ChannelRowProps) {
  const { t } = useTranslation("console");
  const [secretMode, setSecretMode] = useState(false);
  const [secret, setSecret] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  const chatId =
    typeof channel.config?.chat_id === "string" || typeof channel.config?.chat_id === "number"
      ? String(channel.config.chat_id)
      : null;

  return (
    <li className="rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex items-start gap-3 px-3 py-2">
        <span className="mt-0.5 text-lg">{kindIcon(channel.kind)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {channel.name}
            </span>
            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {channel.kind}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                channel.enabled
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                  : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {channel.enabled ? t("setupGcp.channels.enabled") : t("setupGcp.channels.disabled")}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
              {channel.scope}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {chatId && (
              <>
                <span className="font-mono">chat_id: {chatId}</span> ·{" "}
              </>
            )}
            {channel.secret_ref ? (
              <span className="font-mono">{channel.secret_ref}</span>
            ) : (
              <span className="italic">{t("setupGcp.channels.noSecret")}</span>
            )}
            {channel.last_test_at && (
              <>
                {" "}
                · {t("setupGcp.channels.lastTest")}{" "}
                {new Date(channel.last_test_at).toLocaleString()}
              </>
            )}
          </p>
          {testResult && (
            <p
              className={`mt-1 text-xs ${
                testResult.ok
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="mr-1 inline h-3 w-3" />
              ) : (
                <XCircle className="mr-1 inline h-3 w-3" />
              )}
              {testResult.ok
                ? t("setupGcp.channels.testOk")
                : t("setupGcp.channels.testFailed", {
                    detail:
                      typeof testResult.detail === "string"
                        ? testResult.detail
                        : JSON.stringify(testResult.detail ?? {}),
                  })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggle(!channel.enabled)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            {channel.enabled ? t("setupGcp.actions.disable") : t("setupGcp.actions.enable")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setSecretMode((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            <KeyRound className="h-3 w-3" />
            {t("setupGcp.actions.setSecret")}
          </button>
          <button
            type="button"
            disabled={busy || !channel.secret_ref}
            onClick={() => setTestMode((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
          >
            <Send className="h-3 w-3" />
            {t("setupGcp.actions.test")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {secretMode && (
        <div className="border-t border-gray-200 bg-white px-3 py-3 dark:border-gray-700 dark:bg-gray-800">
          <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            {t("setupGcp.channels.secretValue")}
          </label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={t("setupGcp.channels.secretPlaceholder")}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            {t("setupGcp.channels.secretHint")}
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setSecretMode(false);
                setSecret("");
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              {t("setupGcp.actions.cancel")}
            </button>
            <button
              type="button"
              disabled={busy || !secret.trim()}
              onClick={async () => {
                await onSetSecret(secret);
                setSecretMode(false);
                setSecret("");
              }}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {t("setupGcp.actions.save")}
            </button>
          </div>
        </div>
      )}

      {testMode && (
        <div className="border-t border-gray-200 bg-white px-3 py-3 dark:border-gray-700 dark:bg-gray-800">
          <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            {t("setupGcp.channels.testMessage")}
          </label>
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder={t("setupGcp.channels.testMessagePlaceholder")}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setTestMode(false);
                setTestMessage("");
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              {t("setupGcp.actions.cancel")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await onTest(testMessage.trim() || undefined);
                setTestMode(false);
              }}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {t("setupGcp.actions.sendTest")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function kindIcon(kind: string): string {
  if (kind === "telegram") return "✈️";
  if (kind === "discord") return "🎮";
  if (kind === "slack") return "💬";
  return "🔔";
}

interface CreateChannelDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (
    body: { kind: string; name: string; config: Record<string, unknown>; scope?: string },
    secretValue: string,
  ) => Promise<void>;
}

function CreateChannelDialog({ open, onClose, onCreate }: CreateChannelDialogProps) {
  const { t } = useTranslation("console");
  const [kind, setKind] = useState("telegram");
  const [name, setName] = useState("");
  const [chatId, setChatId] = useState("");
  const [scope, setScope] = useState("admin");
  const [secret, setSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const reset = () => {
    setKind("telegram");
    setName("");
    setChatId("");
    setScope("admin");
    setSecret("");
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canSubmit =
    name.trim().length > 0 &&
    (kind !== "telegram" || (chatId.trim().length > 0 && secret.trim().length > 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("setupGcp.channels.createDialog.title")}
        </h3>
        <div className="space-y-3">
          <Field label={t("setupGcp.channels.fields.kind")}>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="telegram">Telegram</option>
              <option value="discord">Discord</option>
              <option value="slack">Slack</option>
            </select>
          </Field>
          <Field label={t("setupGcp.channels.fields.name")}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("setupGcp.channels.fields.namePlaceholder")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </Field>
          <Field label={t("setupGcp.channels.fields.scope")}>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="admin">admin</option>
              <option value="branch">branch</option>
            </select>
          </Field>
          {kind === "telegram" && (
            <>
              <Field label={t("setupGcp.channels.fields.chatId")}>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder={t("setupGcp.channels.fields.chatIdPlaceholder")}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </Field>
              <Field label={t("setupGcp.channels.fields.botToken")}>
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={t("setupGcp.channels.fields.botTokenPlaceholder")}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </Field>
            </>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            {t("setupGcp.actions.cancel")}
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={async () => {
              setSubmitting(true);
              const config: Record<string, unknown> = {};
              if (kind === "telegram") config.chat_id = chatId.trim();
              await onCreate({ kind, name: name.trim(), config, scope }, secret.trim());
              reset();
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? t("setupGcp.actions.creating") : t("setupGcp.actions.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {children}
    </div>
  );
}
