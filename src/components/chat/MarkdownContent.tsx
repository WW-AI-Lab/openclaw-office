import { memo, Suspense, lazy } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { buildSubmissionMessage, parseA2ui } from "@/lib/a2ui-schema";
import type { ChatAttachment } from "@/gateway/adapter-types";
import { useChatDockStore } from "@/store/console-stores/chat-dock-store";

const MermaidPreview = lazy(() =>
  import("@/components/shared/MermaidPreview").then((m) => ({ default: m.MermaidPreview })),
);

const A2uiForm = lazy(() => import("./A2uiForm").then((m) => ({ default: m.A2uiForm })));

function extractTextContent(children: unknown): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractTextContent).join("");
  if (children && typeof children === "object" && "props" in (children as Record<string, unknown>)) {
    return extractTextContent((children as { props: { children?: unknown } }).props.children);
  }
  return "";
}

function A2uiCodeFence({ text }: { text: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs dark:border-gray-700 dark:bg-gray-950">
      <code>{text}</code>
    </pre>
  );
}

/**
 * When `disableA2uiForm` is true we still parse the block (so the parser
 * exercises the same code path) but render the raw JSON as a code fence
 * instead of the interactive A2uiForm. This is used by surfaces that
 * already display the A2UI form elsewhere (e.g. the Workbench "A2UI 调试"
 * tab) so the chat transcript does not duplicate the form.
 */
function A2uiBlock({
  text,
  messageId,
  disableA2uiForm,
}: {
  text: string;
  messageId?: string;
  disableA2uiForm: boolean;
}) {
  const sendMessage = useChatDockStore((s) => s.sendMessage);
  const markSubmitted = useChatDockStore((s) => s.markA2uiSubmitted);
  const submitted = useChatDockStore((s) =>
    messageId ? s.submittedA2uiIds.includes(messageId) : false,
  );

  const form = parseA2ui(text);
  if (!form) {
    return <A2uiCodeFence text={text} />;
  }

  if (disableA2uiForm) {
    return <A2uiCodeFence text={text} />;
  }

  return (
    <Suspense fallback={<A2uiCodeFence text={text} />}>
      <A2uiForm
        form={form}
        readOnly={submitted}
        onSubmit={(values, attachments?: ChatAttachment[]) => {
          if (messageId) markSubmitted(messageId);
          void sendMessage(buildSubmissionMessage(form, values), attachments);
        }}
      />
    </Suspense>
  );
}

interface MarkdownContentProps {
  content: string;
  messageId?: string;
  /**
   * When true, ```` ```a2ui ```` blocks are rendered as plain code fences
   * rather than as the interactive A2uiForm. Useful in surfaces that already
   * expose the A2UI form (e.g. the Workbench "A2UI 调试" tab) so the chat
   * transcript does not duplicate the form.
   */
  disableA2uiForm?: boolean;
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
  messageId,
  disableA2uiForm = false,
}: MarkdownContentProps) {
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
            if (className === "language-a2ui") {
              return (
                <A2uiBlock
                  text={extractTextContent(children)}
                  messageId={messageId}
                  disableA2uiForm={disableA2uiForm}
                />
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
