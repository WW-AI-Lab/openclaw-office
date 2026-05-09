import {
  Bot,
  CheckCircle2,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/console/shared/ConfirmDialog";
import { EmptyState } from "@/components/console/shared/EmptyState";
import { ErrorState } from "@/components/console/shared/ErrorState";
import { LoadingState } from "@/components/console/shared/LoadingState";
import type {
  OpenHandsProfile,
  OpenHandsProvider,
  OpenHandsTestResult,
} from "@/lib/registry-api-client";
import { useSetupGcpStore } from "@/store/console-stores/setupgcp-store";

const PROVIDERS: OpenHandsProvider[] = [
  "google",
  "anthropic",
  "openai",
  "deepseek",
  "minimax",
  "ollama",
];

export function OpenHandsAdminView() {
  const { t } = useTranslation("console");
  const rawItems = useSetupGcpStore((s) => s.openhandsProfiles);
  const items = Array.isArray(rawItems) ? rawItems : [];
  const loading = useSetupGcpStore((s) => s.openhandsLoading);
  const error = useSetupGcpStore((s) => s.openhandsError);
  const inFlight = useSetupGcpStore((s) => s.openhandsActionInFlight);
  const lastTest = useSetupGcpStore((s) => s.lastOpenHandsTest);
  const fetchProfiles = useSetupGcpStore((s) => s.fetchOpenHandsProfiles);
  const createProfile = useSetupGcpStore((s) => s.createProfile);
  const updateProfile = useSetupGcpStore((s) => s.updateProfile);
  const setProfileSecret = useSetupGcpStore((s) => s.setProfileSecret);
  const activateProfile = useSetupGcpStore((s) => s.activateProfile);
  const testProfile = useSetupGcpStore((s) => s.testProfile);
  const deleteProfile = useSetupGcpStore((s) => s.deleteProfile);
  const configured = useSetupGcpStore((s) => s.configured);

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OpenHandsProfile | null>(null);

  useEffect(() => {
    if (configured) void fetchProfiles();
  }, [configured, fetchProfiles]);

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t("setupGcp.openhands.title")}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("setupGcp.openhands.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchProfiles()}
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
            {t("setupGcp.openhands.createProfile")}
          </button>
        </div>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
        <p className="font-medium">{t("setupGcp.openhands.banner.title")}</p>
        <p className="mt-1 text-xs leading-relaxed">{t("setupGcp.openhands.banner.body")}</p>
      </div>

      {!configured ? (
        <NotConfiguredHint />
      ) : loading && items.length === 0 ? (
        <LoadingState />
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={() => fetchProfiles()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bot}
          title={t("setupGcp.openhands.empty.title")}
          description={t("setupGcp.openhands.empty.description")}
          action={{
            label: t("setupGcp.openhands.createProfile"),
            onClick: () => setCreateOpen(true),
          }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              busy={Boolean(inFlight[profile.id])}
              testResult={lastTest[profile.id] ?? null}
              onActivate={() => activateProfile(profile.id)}
              onSetSecret={(secret) => setProfileSecret(profile.id, secret)}
              onTest={(prompt) => testProfile(profile.id, prompt)}
              onUpdate={(body) => updateProfile(profile.id, body)}
              onDelete={() => setDeleteTarget(profile)}
            />
          ))}
        </ul>
      )}

      <CreateProfileDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (body, secretValue) => {
          const created = await createProfile(body);
          if (created && secretValue) {
            await setProfileSecret(created.id, secretValue);
          }
          setCreateOpen(false);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("setupGcp.openhands.deleteDialog.title")}
        description={t("setupGcp.openhands.deleteDialog.description", {
          label: deleteTarget?.label ?? "",
        })}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await deleteProfile(deleteTarget.id);
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

interface ProfileCardProps {
  profile: OpenHandsProfile;
  busy: boolean;
  testResult: OpenHandsTestResult | null;
  onActivate: () => Promise<void> | void;
  onSetSecret: (secret: string) => Promise<void> | void;
  onTest: (prompt?: string) => Promise<OpenHandsTestResult | null>;
  onUpdate: (body: { label?: string; model?: string }) => Promise<void> | void;
  onDelete: () => void;
}

function ProfileCard({
  profile,
  busy,
  testResult,
  onActivate,
  onSetSecret,
  onTest,
  onUpdate,
  onDelete,
}: ProfileCardProps) {
  const { t } = useTranslation("console");
  const [secretMode, setSecretMode] = useState(false);
  const [secret, setSecret] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editLabel, setEditLabel] = useState(profile.label);
  const [editModel, setEditModel] = useState(profile.model);
  const [testMode, setTestMode] = useState(false);
  const [testPrompt, setTestPrompt] = useState("");

  const lastTestSnapshot = formatSnapshot(profile.last_test_result);

  return (
    <li className="flex flex-col rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="mt-0.5 text-xl" aria-hidden>
          {providerIcon(profile.provider)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {profile.label}
            </span>
            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {profile.provider}
            </span>
            {profile.is_default && (
              <span
                className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                title={t("setupGcp.openhands.defaultBadge")}
              >
                <Star className="h-3 w-3 fill-current" />
                {t("setupGcp.openhands.defaultBadge")}
              </span>
            )}
            {profile.has_secret ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                {t("setupGcp.openhands.secretSet")}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                <XCircle className="h-3 w-3" />
                {t("setupGcp.openhands.noSecret")}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-mono">{profile.model}</span>
          </p>
          {profile.last_test_at && (
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
              {t("setupGcp.openhands.lastTest")}{" "}
              {new Date(profile.last_test_at).toLocaleString()}
              {lastTestSnapshot ? <> · <span className="italic">{lastTestSnapshot}</span></> : null}
            </p>
          )}
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
                ? t("setupGcp.openhands.testOk")
                : t("setupGcp.openhands.testFailed", {
                    detail:
                      typeof testResult.detail === "string"
                        ? testResult.detail
                        : JSON.stringify(testResult.detail ?? {}),
                  })}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-200 px-4 py-2 dark:border-gray-700">
        <button
          type="button"
          disabled={busy || profile.is_default}
          onClick={() => onActivate()}
          className="flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20 transition-colors"
        >
          <Zap className="h-3 w-3" />
          {t("setupGcp.openhands.actions.activate")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setSecretMode((v) => !v)}
          className="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          <KeyRound className="h-3 w-3" />
          {t("setupGcp.openhands.actions.setSecret")}
        </button>
        <button
          type="button"
          disabled={busy || !profile.has_secret}
          onClick={() => setTestMode((v) => !v)}
          className="flex items-center gap-1 rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          {t("setupGcp.openhands.actions.test")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditMode((v) => !v)}
          className="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          <Pencil className="h-3 w-3" />
          {t("setupGcp.openhands.actions.edit")}
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

      {secretMode && (
        <div className="border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            {t("setupGcp.openhands.fields.apiKey")}
          </label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={t("setupGcp.openhands.fields.apiKeyPlaceholder")}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            {t("setupGcp.openhands.fields.apiKeyHint")}
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
        <div className="border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            {t("setupGcp.openhands.fields.testPrompt")}
          </label>
          <input
            type="text"
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            placeholder={t("setupGcp.openhands.fields.testPromptPlaceholder")}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setTestMode(false);
                setTestPrompt("");
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              {t("setupGcp.actions.cancel")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await onTest(testPrompt.trim() || undefined);
                setTestMode(false);
              }}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {t("setupGcp.openhands.actions.runTest")}
            </button>
          </div>
        </div>
      )}

      {editMode && (
        <div className="space-y-3 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <Field label={t("setupGcp.openhands.fields.label")}>
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </Field>
          <Field label={t("setupGcp.openhands.fields.model")}>
            <input
              type="text"
              value={editModel}
              onChange={(e) => setEditModel(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditMode(false);
                setEditLabel(profile.label);
                setEditModel(profile.model);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              {t("setupGcp.actions.cancel")}
            </button>
            <button
              type="button"
              disabled={busy || !editLabel.trim() || !editModel.trim()}
              onClick={async () => {
                const body: { label?: string; model?: string } = {};
                if (editLabel.trim() !== profile.label) body.label = editLabel.trim();
                if (editModel.trim() !== profile.model) body.model = editModel.trim();
                if (Object.keys(body).length > 0) await onUpdate(body);
                setEditMode(false);
              }}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {t("setupGcp.actions.save")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function providerIcon(provider: OpenHandsProvider | string): string {
  switch (provider) {
    case "google":
      return "🟢";
    case "anthropic":
      return "🟣";
    case "openai":
      return "🟦";
    case "deepseek":
      return "🐋";
    case "minimax":
      return "✴️";
    case "ollama":
      return "🦙";
    default:
      return "🤖";
  }
}

function formatSnapshot(snapshot: OpenHandsProfile["last_test_result"]): string | null {
  if (!snapshot) return null;
  if (typeof snapshot === "string") return snapshot;
  if (typeof snapshot === "object") {
    const ok = (snapshot as { ok?: unknown }).ok;
    if (typeof ok === "boolean") return ok ? "ok" : "failed";
  }
  return null;
}

interface CreateProfileDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (
    body: { provider: OpenHandsProvider; model: string; label: string },
    secretValue: string,
  ) => Promise<void>;
}

function CreateProfileDialog({ open, onClose, onCreate }: CreateProfileDialogProps) {
  const { t } = useTranslation("console");
  const [provider, setProvider] = useState<OpenHandsProvider>("anthropic");
  const [model, setModel] = useState("");
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const reset = () => {
    setProvider("anthropic");
    setModel("");
    setLabel("");
    setSecret("");
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canSubmit = label.trim().length > 0 && model.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("setupGcp.openhands.createDialog.title")}
        </h3>
        <div className="space-y-3">
          <Field label={t("setupGcp.openhands.fields.provider")}>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as OpenHandsProvider)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("setupGcp.openhands.fields.model")}>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={t("setupGcp.openhands.fields.modelPlaceholder")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </Field>
          <Field label={t("setupGcp.openhands.fields.label")}>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("setupGcp.openhands.fields.labelPlaceholder")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </Field>
          <Field label={t("setupGcp.openhands.fields.apiKeyOptional")}>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={t("setupGcp.openhands.fields.apiKeyPlaceholder")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </Field>
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
              await onCreate(
                { provider, model: model.trim(), label: label.trim() },
                secret.trim(),
              );
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
