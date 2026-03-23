import { Clock3, X } from "lucide-react";
import { useEffect, useRef, type UIEvent } from "react";
import { useTranslation } from "react-i18next";
import { TimelineEventList } from "@/components/panels/TimelineEventList";
import { useOfficeStore } from "@/store/office-store";

export function EventTimelineDialog() {
  const { t } = useTranslation(["layout", "common"]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = useOfficeStore((state) => state.timelineDialogOpen);
  const events = useOfficeStore((state) => state.timelineDialogEvents);
  const loading = useOfficeStore((state) => state.timelineDialogLoading);
  const loadingMore = useOfficeStore((state) => state.timelineDialogLoadingMore);
  const hasMore = useOfficeStore((state) => state.timelineDialogHasMore);
  const closeTimelineDialog = useOfficeStore((state) => state.closeTimelineDialog);
  const loadMoreTimelineEvents = useOfficeStore((state) => state.loadMoreTimelineEvents);
  const selectAgent = useOfficeStore((state) => state.selectAgent);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 120) {
      void loadMoreTimelineEvents();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={closeTimelineDialog}
      className="fixed inset-0 z-50 m-auto max-h-[88vh] w-[min(1080px,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/40 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex max-h-[88vh] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t("layout:topbar.timeline.title")}
              </h3>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("layout:topbar.timeline.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={closeTimelineDialog}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title={t("common:actions.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <TimelineEventList
          events={events}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          emptyLabel={t("common:empty.noEvents")}
          onSelectAgent={(agentId) => {
            selectAgent(agentId);
          }}
          onScroll={handleScroll}
        />
      </div>
    </dialog>
  );
}
