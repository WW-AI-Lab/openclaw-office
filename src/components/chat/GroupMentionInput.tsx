import { AtSign, Users } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import TextareaAutosize from "react-textarea-autosize";
import {
  ALL_AGENTS_MENTION,
  type MentionableAgent,
  normalizeMentionToken,
} from "@/lib/group-chat";
import { useOfficeStore } from "@/store/office-store";

interface GroupMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFocus?: () => void;
  onEscape?: () => void;
  placeholder: string;
  maxRows?: number;
}

interface MentionSuggestion {
  id: string;
  label: string;
  insertText: string;
  keywords: string[];
  isAll?: boolean;
}

interface ActiveMentionContext {
  start: number;
  end: number;
  query: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHighlightedMentions(value: string): string {
  if (!value) {
    return "";
  }

  const mentionRegex = /(^|\s)@([^\s@]+)/gu;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = mentionRegex.exec(value)) !== null) {
    const mentionStart = match.index + match[1].length;
    const mentionEnd = mentionStart + 1 + match[2].length;
    result += escapeHtml(value.slice(lastIndex, mentionStart));
    result += `<span class="rounded bg-sky-100 px-0.5 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">@${escapeHtml(match[2])}</span>`;
    lastIndex = mentionEnd;
  }

  result += escapeHtml(value.slice(lastIndex));
  return value.endsWith("\n") ? `${result}\n ` : result;
}

function getActiveMentionContext(value: string, caret: number | null): ActiveMentionContext | null {
  if (caret == null) {
    return null;
  }

  const prefix = value.slice(0, caret);
  const match = /(^|\s)@([^\s@]*)$/u.exec(prefix);
  if (!match) {
    return null;
  }

  const query = match[2] ?? "";
  return {
    start: caret - query.length - 1,
    end: caret,
    query,
  };
}

function getMentionInsertText(agent: MentionableAgent): string {
  const trimmedName = agent.name.trim();
  if (trimmedName.length > 0 && !/\s/.test(trimmedName)) {
    return trimmedName;
  }
  return agent.id;
}

function matchesQuery(suggestion: MentionSuggestion, query: string): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeMentionToken(query);
  if (!normalizedQuery) {
    return true;
  }

  return suggestion.keywords.some((keyword) => {
    const normalizedKeyword = normalizeMentionToken(keyword);
    return (
      normalizedKeyword.startsWith(normalizedQuery) || normalizedKeyword.includes(normalizedQuery)
    );
  });
}

export const GroupMentionInput = forwardRef<HTMLTextAreaElement, GroupMentionInputProps>(
  function GroupMentionInput(
    { value, onChange, onSubmit, onFocus, onEscape, placeholder, maxRows = 4 },
    forwardedRef,
  ) {
    const { t } = useTranslation("chat");
    const agents = useOfficeStore((state) => state.agents);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const highlightRef = useRef<HTMLDivElement | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [isComposing, setIsComposing] = useState(false);
    const [activeMention, setActiveMention] = useState<ActiveMentionContext | null>(null);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

    const mentionableAgents = useMemo(
      () =>
        Array.from(agents.values())
          .filter((agent) => agent.confirmed && !agent.isPlaceholder && !agent.isSubAgent)
          .map((agent) => ({ id: agent.id, name: agent.name })),
      [agents],
    );

    const suggestions = useMemo<MentionSuggestion[]>(() => {
      const allOption: MentionSuggestion = {
        id: ALL_AGENTS_MENTION,
        label: t("dock.mentionAllLabel"),
        insertText: t("dock.mentionAllLabel"),
        keywords: [ALL_AGENTS_MENTION, "everyone", "所有人", t("dock.mentionAllLabel")],
        isAll: true,
      };

      const agentOptions = mentionableAgents.map((agent) => ({
        id: agent.id,
        label: agent.name || agent.id,
        insertText: getMentionInsertText(agent),
        keywords: [agent.id, agent.name],
      }));

      return [allOption, ...agentOptions];
    }, [mentionableAgents, t]);

    const filteredSuggestions = useMemo(() => {
      if (!activeMention) {
        return [];
      }

      return suggestions.filter((suggestion) => matchesQuery(suggestion, activeMention.query));
    }, [activeMention, suggestions]);

    useEffect(() => {
      setSelectedSuggestionIndex(0);
    }, [activeMention?.query]);

    const syncMentionContext = useCallback(
      (nextValue: string, nextCaret: number | null) => {
        setActiveMention(getActiveMentionContext(nextValue, nextCaret));
      },
      [],
    );

    const setTextareaNode = useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const handleTextareaScroll = useCallback(() => {
      if (!textareaRef.current || !highlightRef.current) {
        return;
      }

      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    }, []);

    const applySuggestion = useCallback(
      (suggestion: MentionSuggestion) => {
        const textarea = textareaRef.current;
        const selectionStart = textarea?.selectionStart ?? value.length;
        const selectionEnd = textarea?.selectionEnd ?? value.length;
        const context = getActiveMentionContext(value, selectionStart);
        if (!context) {
          return;
        }

        const nextValue = `${value.slice(0, context.start)}@${suggestion.insertText} ${value.slice(selectionEnd)}`;
        const nextCaret = context.start + suggestion.insertText.length + 2;

        onChange(nextValue);
        setActiveMention(null);

        requestAnimationFrame(() => {
          textarea?.focus();
          textarea?.setSelectionRange(nextCaret, nextCaret);
          syncMentionContext(nextValue, nextCaret);
        });
      },
      [onChange, syncMentionContext, value],
    );

    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const nextValue = event.target.value;
        onChange(nextValue);
        syncMentionContext(nextValue, event.target.selectionStart);
      },
      [onChange, syncMentionContext],
    );

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (filteredSuggestions.length > 0 && activeMention) {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedSuggestionIndex((current) => (current + 1) % filteredSuggestions.length);
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedSuggestionIndex((current) =>
              current === 0 ? filteredSuggestions.length - 1 : current - 1,
            );
            return;
          }

          if ((event.key === "Enter" && !event.shiftKey && !isComposing) || event.key === "Tab") {
            event.preventDefault();
            applySuggestion(filteredSuggestions[selectedSuggestionIndex] ?? filteredSuggestions[0]);
            return;
          }
        }

        if (event.key === "Enter" && !event.shiftKey && !isComposing) {
          event.preventDefault();
          onSubmit();
          return;
        }

        if (event.key === "Escape") {
          if (activeMention) {
            event.preventDefault();
            setActiveMention(null);
            return;
          }

          onEscape?.();
        }
      },
      [
        activeMention,
        applySuggestion,
        filteredSuggestions,
        isComposing,
        onEscape,
        onSubmit,
        selectedSuggestionIndex,
      ],
    );

    const highlightedMarkup = useMemo(() => renderHighlightedMentions(value), [value]);

    return (
      <div className="relative flex-1">
        <div
          className={`relative rounded-lg border transition-colors ${
            isFocused
              ? "border-blue-400 bg-white dark:border-blue-500 dark:bg-gray-900"
              : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
          }`}
        >
          <div
            ref={highlightRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg px-3 py-1.5 text-sm leading-6 text-gray-900 dark:text-gray-100"
          >
            {value ? (
              <div
                className="whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: highlightedMarkup }}
              />
            ) : (
              <div className="text-gray-400 dark:text-gray-500">{placeholder}</div>
            )}
          </div>

          <TextareaAutosize
            ref={setTextareaNode}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onClick={(event) =>
              syncMentionContext(event.currentTarget.value, event.currentTarget.selectionStart)
            }
            onKeyUp={(event) =>
              syncMentionContext(event.currentTarget.value, event.currentTarget.selectionStart)
            }
            onScroll={handleTextareaScroll}
            onFocus={(event) => {
              setIsFocused(true);
              syncMentionContext(event.currentTarget.value, event.currentTarget.selectionStart);
              onFocus?.();
            }}
            onBlur={() => {
              setIsFocused(false);
              requestAnimationFrame(() => {
                if (document.activeElement !== textareaRef.current) {
                  setActiveMention(null);
                }
              });
            }}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(event) => {
              setIsComposing(false);
              syncMentionContext(event.currentTarget.value, event.currentTarget.selectionStart);
            }}
            placeholder=""
            maxRows={maxRows}
            className="relative z-10 w-full resize-none bg-transparent px-3 py-1.5 text-sm leading-6 text-transparent caret-gray-900 outline-none [text-shadow:0_0_0_rgba(0,0,0,0)] dark:caret-gray-100"
            style={{
              WebkitTextFillColor: "transparent",
            }}
          />
        </div>

        {activeMention && (
          <div className="absolute bottom-full left-0 right-0 z-30 mb-2 rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.slice(0, 8).map((suggestion, index) => {
                const isActive = index === selectedSuggestionIndex;

                return (
                  <button
                    key={`${suggestion.id}-${suggestion.insertText}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      applySuggestion(suggestion);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-sky-50 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                      {suggestion.isAll ? <Users className="h-4 w-4" /> : <AtSign className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{suggestion.label}</div>
                      <div className="truncate text-xs text-gray-400">
                        {suggestion.isAll
                          ? t("dock.mentionAllDescription")
                          : `@${suggestion.insertText}`}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-gray-400">
                {t("dock.mentionSearchEmpty")}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
