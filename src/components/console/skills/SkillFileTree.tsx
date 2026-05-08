import { memo } from "react";
import { FileText, File } from "lucide-react";

interface SkillFileTreeProps {
  files: string[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

function fileIcon(name: string) {
  if (name.endsWith(".md")) return FileText;
  return File;
}

export const SkillFileTree = memo(function SkillFileTree({
  files,
  selectedFile,
  onSelectFile,
}: SkillFileTreeProps) {
  return (
    <div className="space-y-0.5">
      {files.map((f) => {
        const Icon = fileIcon(f);
        const isActive = f === selectedFile;
        return (
          <button
            key={f}
            onClick={() => onSelectFile(f)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
              isActive
                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{f}</span>
          </button>
        );
      })}
    </div>
  );
});
