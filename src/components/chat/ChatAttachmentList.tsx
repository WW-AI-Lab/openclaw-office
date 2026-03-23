import { File, FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  type ChatAttachment,
  describeAttachment,
} from "@/lib/chat-attachments";

interface ChatAttachmentListProps {
  attachments: ChatAttachment[];
  onRemove?: (attachmentId: string) => void;
  onClearAll?: () => void;
}

function getAttachmentIcon(attachment: ChatAttachment) {
  if (attachment.kind === "text") return FileText;
  if (attachment.kind === "image") return ImageIcon;
  return File;
}

export function ChatAttachmentList({
  attachments,
  onRemove,
  onClearAll,
}: ChatAttachmentListProps) {
  const { t } = useTranslation("chat");

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          <Paperclip className="h-3.5 w-3.5" />
          <span>{t("dock.attachmentsLabel")}</span>
        </div>
        {onClearAll && attachments.length > 1 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
          >
            {t("dock.attachmentClearAll")}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment) => {
          const Icon = getAttachmentIcon(attachment);

          return (
            <div
              key={attachment.id}
              className="flex max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              {attachment.kind === "image" && attachment.imagePreviewUrl ? (
                <img
                  src={attachment.imagePreviewUrl}
                  alt={attachment.name}
                  className="h-9 w-9 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-gray-400 dark:bg-gray-900 dark:text-gray-500">
                  <Icon className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-medium">{attachment.name}</div>
                <div className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                  {describeAttachment(attachment)}
                </div>
              </div>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(attachment.id)}
                  className="ml-1 rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-red-500 dark:hover:bg-gray-700 dark:hover:text-red-400"
                  title={t("dock.attachmentRemove")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
