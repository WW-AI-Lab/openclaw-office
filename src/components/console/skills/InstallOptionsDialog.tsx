import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface InstallOption {
  id: string;
  kind: string;
  label: string;
}

interface InstallOptionsDialogProps {
  open: boolean;
  skillName: string;
  options: InstallOption[];
  onSelect: (installId: string) => void;
  onCancel: () => void;
}

export function InstallOptionsDialog({
  open,
  skillName,
  options,
  onSelect,
  onCancel,
}: InstallOptionsDialogProps) {
  const { t } = useTranslation("console");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 z-50 m-auto max-w-sm rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-black/40 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("skills.install.title", { name: skillName })}
        </h3>
        <div className="space-y-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:hover:border-blue-600 dark:hover:bg-blue-900/10"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {opt.label}
              </span>
              <span className="text-xs text-gray-400">({opt.kind})</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            {t("common:actions.cancel")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
