import { memo, useCallback, useEffect, useState } from "react";
import { useMermaidRenderer } from "@/hooks/useMermaidRenderer";

interface MermaidPreviewProps {
  source: string;
  className?: string;
}

export const MermaidPreview = memo(function MermaidPreview({ source, className }: MermaidPreviewProps) {
  const { render } = useMermaidRenderer();
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState("");
  const [loading, setLoading] = useState(true);

  const doRender = useCallback(
    async (src: string) => {
      setLoading(true);
      const { svg, error: renderError } = await render(src);
      if (renderError) {
        setError(renderError);
        setSvg("");
        setLoading(false);
        return;
      }

      setError(null);
      setSvg(svg);
      setLoading(false);
    },
    [render],
  );

  useEffect(() => {
    if (source.trim()) {
      doRender(source);
    } else {
      setError(null);
      setSvg("");
      setLoading(false);
    }
  }, [source, doRender]);

  if (error) {
    return (
      <div className={className}>
        <div className="mb-2 rounded bg-red-50 px-3 py-1.5 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
          Mermaid render error
        </div>
        <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
          <code>{source}</code>
        </pre>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className ?? ""}`}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
      </div>
    );
  }

  return <div className={`mermaid-preview overflow-x-auto ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: svg }} />;
});
