import { memo, Suspense, lazy } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MermaidPreview = lazy(() =>
  import("@/components/shared/MermaidPreview").then((m) => ({ default: m.MermaidPreview })),
);

function extractTextContent(children: unknown): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractTextContent).join("");
  if (children && typeof children === "object" && "props" in (children as Record<string, unknown>)) {
    return extractTextContent((children as { props: { children?: unknown } }).props.children);
  }
  return "";
}

interface MarkdownContentProps {
  content: string;
}

export const MarkdownContent = memo(function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="prose prose-sm max-w-none break-words dark:prose-invert prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children, ...props }) => (
            <p className="whitespace-pre-wrap leading-7" {...props}>
              {children}
            </p>
          ),
          h1: ({ children, ...props }) => (
            <h1 className="mt-4 text-xl font-semibold tracking-tight" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="mt-4 text-lg font-semibold tracking-tight" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="mt-3 text-base font-semibold" {...props}>
              {children}
            </h3>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="border-l-2 border-blue-200 pl-4 text-gray-600 dark:border-blue-800 dark:text-gray-300"
              {...props}
            >
              {children}
            </blockquote>
          ),
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs" {...props}>
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th
              className="border-b border-gray-200 px-3 py-2 font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border-b border-gray-100 px-3 py-2 align-top dark:border-gray-800" {...props}>
              {children}
            </td>
          ),
          pre: ({ children, ...props }) => (
            <pre
              className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              {...props}
            >
              {children}
            </pre>
          ),
          code: ({ children, className, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.85em] dark:bg-gray-800"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            if (className === "language-mermaid") {
              const text = extractTextContent(children);
              return (
                <Suspense
                  fallback={
                    <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs dark:border-gray-700 dark:bg-gray-950">
                      <code>{text}</code>
                    </pre>
                  }
                >
                  <MermaidPreview source={text} />
                </Suspense>
              );
            }
            return (
              <code className={`${className ?? ""} bg-transparent !text-gray-800 dark:!text-gray-100`} {...props}>
                {children}
              </code>
            );
          },
          a: ({ children, ...props }) => (
            <a
              className="text-blue-600 underline dark:text-blue-400"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
});
