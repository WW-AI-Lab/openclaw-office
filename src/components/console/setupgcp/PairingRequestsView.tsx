import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/console/shared/EmptyState";
import { ErrorState } from "@/components/console/shared/ErrorState";
import { LoadingState } from "@/components/console/shared/LoadingState";
import type { PairingRequest, PairingStatus } from "@/lib/registry-api-client";
import { useSetupGcpStore } from "@/store/console-stores/setupgcp-store";

const STATUS_OPTIONS: Array<PairingStatus | "all"> = [
  "pending",
  "approved",
  "rejected",
  "smoke_passed",
  "smoke_failed",
  "all",
];

interface PairingRequestsViewProps {
  defaultDecidedBy: string;
}

export function PairingRequestsView({ defaultDecidedBy }: PairingRequestsViewProps) {
  const { t } = useTranslation("console");
  const rawItems = useSetupGcpStore((s) => s.pairingItems);
  // Defensive coercion: if upstream ever passed something other than an array
  // (malformed API payload, partial state hydration), `.map()` would otherwise
  // throw inside render and crash the whole React tree.
  const items = Array.isArray(rawItems) ? rawItems : [];
  const loading = useSetupGcpStore((s) => s.pairingLoading);
  const error = useSetupGcpStore((s) => s.pairingError);
  const filter = useSetupGcpStore((s) => s.pairingFilter);
  const inFlight = useSetupGcpStore((s) => s.pairingActionInFlight);
  const fetchPairing = useSetupGcpStore((s) => s.fetchPairing);
  const setFilter = useSetupGcpStore((s) => s.setPairingFilter);
  const approve = useSetupGcpStore((s) => s.approvePairing);
  const reject = useSetupGcpStore((s) => s.rejectPairing);
  const configured = useSetupGcpStore((s) => s.configured);

  useEffect(() => {
    if (configured) void fetchPairing();
  }, [configured, fetchPairing]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const it of items) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [items]);

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t("setupGcp.pairing.title")}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("setupGcp.pairing.description")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchPairing()}
          disabled={loading || !configured}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("setupGcp.actions.refresh")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const isActive = filter === opt;
          const count = opt === "all" ? items.length : (counts[opt] ?? 0);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setFilter(opt)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              {t(`setupGcp.pairing.statusFilter.${opt}`)}
              {opt !== "all" && filter === opt && (
                <span className="ml-1 opacity-80">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {!configured ? (
        <NotConfiguredHint />
      ) : loading && items.length === 0 ? (
        <LoadingState />
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={() => fetchPairing()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t("setupGcp.pairing.empty.title")}
          description={t("setupGcp.pairing.empty.description")}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <PairingRow
              key={item.id}
              item={item}
              busy={Boolean(inFlight[item.id])}
              defaultDecidedBy={defaultDecidedBy}
              onApprove={(decidedBy) => approve(item.id, decidedBy)}
              onReject={(decidedBy, reason) => reject(item.id, decidedBy, reason)}
            />
          ))}
        </ul>
      )}
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

interface PairingRowProps {
  item: PairingRequest;
  busy: boolean;
  defaultDecidedBy: string;
  onApprove: (decidedBy: string) => Promise<void> | void;
  onReject: (decidedBy: string, reason: string) => Promise<void> | void;
}

function PairingRow({ item, busy, defaultDecidedBy, onApprove, onReject }: PairingRowProps) {
  const { t } = useTranslation("console");
  const [expanded, setExpanded] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");

  const isPending = item.status === "pending";

  return (
    <li className="rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {item.branch_id}
            </span>
            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {item.hostname}
            </span>
            <StatusPill status={item.status} />
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            {item.tailscale_ip} · {t("setupGcp.pairing.coordinator")} {item.coordinator_agent_id} ·{" "}
            {new Date(item.requested_at).toLocaleString()}
          </p>
        </div>
        {isPending && !rejectMode && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onApprove(defaultDecidedBy)}
              className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("setupGcp.actions.approve")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejectMode(true)}
              className="flex items-center gap-1 rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              {t("setupGcp.actions.reject")}
            </button>
          </div>
        )}
      </div>

      {isPending && rejectMode && (
        <div className="border-t border-gray-200 bg-white px-3 py-3 dark:border-gray-700 dark:bg-gray-800">
          <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            {t("setupGcp.pairing.rejectReason")}
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("setupGcp.pairing.rejectReasonPlaceholder")}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRejectMode(false);
                setReason("");
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              {t("setupGcp.actions.cancel")}
            </button>
            <button
              type="button"
              disabled={busy || !reason.trim()}
              onClick={async () => {
                await onReject(defaultDecidedBy, reason.trim());
                setRejectMode(false);
                setReason("");
              }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {t("setupGcp.actions.confirmReject")}
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="border-t border-gray-200 bg-white px-3 py-3 text-xs dark:border-gray-700 dark:bg-gray-800">
          <DetailGrid item={item} />
        </div>
      )}
    </li>
  );
}

function StatusPill({ status }: { status: PairingStatus }) {
  const { t } = useTranslation("console");
  const color: Record<PairingStatus, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    smoke_passed: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    smoke_failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  };
  const tone =
    color[status] ?? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
  const label = status ? t(`setupGcp.pairing.status.${status}`) : "—";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>{label}</span>
  );
}

function DetailGrid({ item }: { item: PairingRequest }) {
  const { t } = useTranslation("console");
  const allowedAgents = Array.isArray(item.allowed_agents) ? item.allowed_agents : [];
  const rows: Array<[string, string]> = [
    [t("setupGcp.pairing.fields.delegateUrl"), item.delegate_url ?? "—"],
    [t("setupGcp.pairing.fields.allowedAgents"), allowedAgents.join(", ") || "—"],
    [
      t("setupGcp.pairing.fields.tokenFingerprint"),
      item.delegation_token_fingerprint ?? "—",
    ],
    [t("setupGcp.pairing.fields.decidedBy"), item.decided_by ?? "—"],
    [
      t("setupGcp.pairing.fields.decidedAt"),
      item.decided_at ? new Date(item.decided_at).toLocaleString() : "—",
    ],
  ];
  return (
    <dl className="grid grid-cols-1 gap-y-1 sm:grid-cols-[180px_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
          <dd className="font-mono text-gray-700 dark:text-gray-200 break-all">{v}</dd>
        </div>
      ))}
      {item.metadata && Object.keys(item.metadata).length > 0 && (
        <div className="contents">
          <dt className="text-gray-500 dark:text-gray-400">
            {t("setupGcp.pairing.fields.metadata")}
          </dt>
          <dd className="font-mono text-gray-700 dark:text-gray-200">
            <pre className="whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-[11px] dark:bg-gray-900">
              {JSON.stringify(item.metadata, null, 2)}
            </pre>
          </dd>
        </div>
      )}
    </dl>
  );
}
