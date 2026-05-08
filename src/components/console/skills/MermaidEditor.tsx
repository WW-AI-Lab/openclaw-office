import { memo, useCallback, useEffect, useRef, useState } from "react";
import { MermaidPreview } from "@/components/shared/MermaidPreview";

interface MermaidEditorProps {
  source: string;
  onChange: (source: string) => void;
}

export const MermaidEditor = memo(function MermaidEditor({ source, onChange }: MermaidEditorProps) {
  const [localValue, setLocalValue] = useState(source);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(source);
  }, [source]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setLocalValue(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange(val), 300);
    },
    [onChange],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-2">
      <textarea
        value={localValue}
        onChange={handleChange}
        spellCheck={false}
        className="min-h-[120px] flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-relaxed outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-600 dark:focus:ring-blue-800"
      />
      <div className="min-h-[100px] flex-1 overflow-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
        <MermaidPreview source={localValue} />
      </div>
    </div>
  );
});
