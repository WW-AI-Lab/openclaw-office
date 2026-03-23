import { Loader2, Paperclip } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  filesToChatAttachments,
  type ChatAttachment,
} from "@/lib/chat-attachments";

interface ChatAttachmentPickerProps {
  onAttachmentsSelected: (attachments: ChatAttachment[]) => void;
  onError: (message: string) => void;
}

export function ChatAttachmentPicker({
  onAttachmentsSelected,
  onError,
}: ChatAttachmentPickerProps) {
  const { t } = useTranslation("chat");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isReading, setIsReading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    setIsReading(true);
    try {
      const attachments = await filesToChatAttachments(Array.from(files));
      onAttachmentsSelected(attachments);
    } catch (error) {
      onError(
        t("dock.attachmentReadFailed", {
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      setIsReading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        title={isReading ? t("dock.attachmentLoading") : t("dock.attachmentSelect")}
        aria-label={t("dock.attachmentSelect")}
      >
        {isReading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
      </button>
      <input
        ref={inputRef}
        type="file"
        name="chat-attachments"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
        }}
        aria-label={t("dock.attachmentSelect")}
      />
    </>
  );
}
