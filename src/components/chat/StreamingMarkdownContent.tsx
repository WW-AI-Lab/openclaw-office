import { memo, useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import type { ReactNode } from "react";
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

interface StreamingMarkdownContentProps {
  content: string;
  isStreaming?: boolean;
}

const PARAGRAPH_BREAK = /\n\n/;
const CHUNK_THRESHOLD = 500;

function renderCodeFence(text: string) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
      <code>{text}</code>
    </pre>
  );
}

function isCodeBlockOpen(text: string): boolean {
  const fenceMatches = text.match(/^```/gm);
  return fenceMatches !== null && fenceMatches.length % 2 !== 0;
}

function splitCompletedChunks(text: string): { completed: string; tail: string } {
  if (text.length < CHUNK_THRESHOLD) {
    return { completed: "", tail: text };
  }

  const parts = text.split(PARAGRAPH_BREAK);
  if (parts.length <= 1) {
    return { completed: "", tail: text };
  }

  let splitIndex = parts.length - 1;
  const joined = parts.slice(0, splitIndex).join("\n\n");
  if (isCodeBlockOpen(joined)) {
    for (let i = splitIndex - 1; i > 0; i--) {
      const candidate = parts.slice(0, i).join("\n\n");
      if (!isCodeBlockOpen(candidate)) {
        splitIndex = i;
        break;
      }
    }
    if (isCodeBlockOpen(parts.slice(0, splitIndex).join("\n\n"))) {
      return { completed: "", tail: text };
    }
  }

  return {
    completed: parts.slice(0, splitIndex).join("\n\n"),
    tail: parts.slice(splitIndex).join("\n\n"),
  };
}

function createMarkdownComponents(renderMermaidPreview: boolean) {
  return {
  p: ({ children, ...props }: Record<string, unknown>) => {
    const { node: _node, ...rest } = props as Record<string, unknown> & { node?: unknown };
    return (
      <p className="whitespace-pre-wrap leading-7" {...rest}>
        {children as ReactNode}
      </p>
    );
  },
  h1: ({ children, ...props }: Record<string, unknown>) => {
    const { node: _node, ...rest } = props as Record<string, unknown> & { node?: unknown };
    return (
      <h1 className="mt-4 text-xl font-semibold tracking-tight" {...rest}>
        {children as ReactNode}
      </h1>
    );
  },
  h2: ({ children, ...props }: Record<string, unknown>) => {
    const { node: _node, ...rest } = props as Record<string, unknown> & { node?: unknown };
    return (
      <h2 className="mt-4 text-lg font-semibold tracking-tight" {...rest}>
        {children as ReactNode}
      </h2>
    );
  },
  h3: ({ children, ...props }: Record<string, unknown>) => {
    const { node: _node, ...rest } = props as Record<string, unknown> & { node?: unknown };
    return (
      <h3 className="mt-3 text-base font-semibold" {...rest}>
        {children as ReactNode}
      </h3>
    );
  },
  blockquote: ({ children, ...props }: Record<string, unknown>) => {
    const { node: _node, ...rest } = props as Record<string, unknown> & { node?: unknown };
    return (
      <blockquote
        className="border-l-2 border-blue-200 pl-4 text-gray-600 dark:border-blue-800 dark:text-gray-300"
        {...rest}
      >
        {children as ReactNode}
      </blockquote>
    );
  },
  table: ({ children, ...props }: Record<string, unknown>) => {
    const { node: _node, ...rest } = props as Record<string, unknown> & { node?: unknown };
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs" {...rest}>
          {children as ReactNode}
        </table>
      </div>
    );
  },
  th: ({ children, ...props }: Record<string, unknown>) => {
    const { node: _node, ...rest } = props as Record<string, unknown> & { node?: unknown };
    return (
      <th
        className="border-b border-gray-200 px-3 py-2 font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
        {...rest}
      >
        {children as ReactNode}
      </th>
    );
  },
  td: ({ children, ...props }: Record<string, unknown>) => {
    const { node: _node, ...rest } = props as Record<string, unknown> & { node?: unknown };
    return (
      <td className="border-b border-gray-100 px-3 py-2 align-top dark:border-gray-800" {...rest}>
        {children as ReactNode}
      </td>
    );
  },
  pre: ({ children, ...props }: Record<string, unknown>) => {
    const { node: _node, ...rest } = props as Record<string, unknown> & { node?: unknown };
    return (
      <pre
        className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
        {...rest}
      >
        {children as ReactNode}
      </pre>
    );
  },
  code: ({ children, className, ...props }: Record<string, unknown>) => {
    const { node: _node, ...rest } = props as Record<string, unknown> & { node?: unknown };
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.85em] dark:bg-gray-800"
          {...rest}
        >
          {children as ReactNode}
        </code>
      );
    }
    if (className === "language-mermaid") {
      const text = extractTextContent(children);
      if (!renderMermaidPreview) {
        return renderCodeFence(text);
      }
      return (
        <Suspense fallback={renderCodeFence(text)}>
          <MermaidPreview source={text} />
        </Suspense>
      );
    }
    return (
      <code
        className={`${(className as string) ?? ""} bg-transparent !text-gray-800 dark:!text-gray-100`}
        {...rest}
      >
        {children as ReactNode}
      </code>
    );
  },
  a: ({ children, ...props }: Record<string, unknown>) => {
    const { node: _node, ...rest } = props as Record<string, unknown> & { node?: unknown };
    return (
      <a
        className="text-blue-600 underline dark:text-blue-400"
        target="_blank"
        rel="noopener noreferrer"
        {...rest}
      >
        {children as ReactNode}
      </a>
    );
  },
  };
}

export const StreamingMarkdownContent = memo(function StreamingMarkdownContent({
  content,
  isStreaming = false,
}: StreamingMarkdownContentProps) {
  const cachedRef = useRef<{ key: string; node: ReactNode }>({ key: "", node: null });
  const pendingRef = useRef(content);
  const rafRef = useRef<number | null>(null);
  const [batchedContent, setBatchedContent] = useState(content);

  useEffect(() => {
    pendingRef.current = content;
    if (!isStreaming) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setBatchedContent(content);
      return;
    }
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setBatchedContent(pendingRef.current);
    });
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [content, isStreaming]);

  const renderSource = isStreaming ? batchedContent : content;

  const { completed, tail } = useMemo(
    () => (isStreaming ? splitCompletedChunks(renderSource) : { completed: "", tail: renderSource }),
    [renderSource, isStreaming],
  );
  const markdownComponents = useMemo(() => createMarkdownComponents(!isStreaming), [isStreaming]);

  const completedNode = useMemo(() => {
    if (!completed) return null;
    if (cachedRef.current.key === completed) return cachedRef.current.node;
    const node = (
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents as never}>
        {completed}
      </Markdown>
    );
    cachedRef.current = { key: completed, node };
    return node;
  }, [completed]);

  return (
    <div className="prose prose-sm max-w-none break-words dark:prose-invert prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
      {completedNode}
      {tail && (
        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents as never}>
          {tail}
        </Markdown>
      )}
    </div>
  );
});
