import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import * as ContextMenu from "@radix-ui/react-context-menu";
import React from "react";
import {
  Copy,
  RefreshCw,
  BookmarkPlus,
  Trash2,
  ThumbsDown,
  Check,
  Maximize2,
  Image as ImageIcon,
  Terminal,
  FileCode,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
} from "lucide-react";

export interface Message {
  id: string;
  role: "user" | "rosia";
  text: string;
  image?: string;
  imageLoading?: boolean;
  time: string;
}

interface ChatMessageProps {
  message: Message;
  previousUserPrompt?: string;
  isDark: boolean;
  onRegenerate?: (id: string) => void;
  onPreviewImage: (url: string) => void;
  onSaveToMemory?: (id: string) => void;
  onDelete?: (id: string) => void;
  onFeedback?: (payload: { messageId: string; prompt: string; response: string }) => void;
}

function renderRosiaContent(text: string, isDark: boolean) {
  // Extract inline tool tags like [CALL_TOOL: read_file path=...] or [TRIGGER_SELFIE]
  const toolMatch = text.match(/\[(CALL_TOOL|TRIGGER_SELFIE|EXECUTE_SHELL|UPDATE_RULE)[^\]]*\]/gi);
  const cleanedText = text.replace(/\[(TRIGGER_SELFIE|CALL_TOOL|EXECUTE_SHELL|UPDATE_RULE)[^\]]*\]?/gi, "");

  // Match short single-line action phrases like *smiles warmly*, *nods gently*
  const parts = cleanedText.split(/(\*[^\*\n]{1,60}\*)/g).filter(Boolean);

  return (
    <div className="flex flex-col gap-2">
      {/* Tool Execution Badges if present */}
      {toolMatch && toolMatch.map((t, idx) => (
        <ToolExecutionBadge key={idx} toolTag={t} isDark={isDark} />
      ))}

      {/* Main message text */}
      <div>
        {parts.map((part, i) => {
          const inner = part.slice(1, -1).trim();
          const isActionPill =
            part.startsWith("*") &&
            part.endsWith("*") &&
            part.length <= 62 &&
            !part.includes("\n") &&
            !/[#:|>\-\[\]]/.test(inner);

          if (isActionPill) {
            return (
              <span
                key={i}
                className="inline-block px-2.5 py-0.5 mx-0.5 rounded-md italic align-baseline transition-all duration-300 hover:scale-[1.02] cursor-default"
                style={{
                  color: isDark ? "#C084FC" : "#7E3AF2",
                  background: isDark
                    ? "rgba(168, 85, 247, 0.08)"
                    : "rgba(126, 58, 242, 0.05)",
                  border: isDark
                    ? "1px solid rgba(168, 85, 247, 0.15)"
                    : "1px solid rgba(126, 58, 242, 0.12)",
                  boxShadow: isDark ? "0 0 10px rgba(168, 85, 247, 0.08)" : "none",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "14.5px",
                }}
              >
                {inner}
              </span>
            );
          }
          return <MarkdownChunk key={i} text={part} isDark={isDark} />;
        })}
      </div>
    </div>
  );
}

function ToolExecutionBadge({ toolTag, isDark }: { toolTag: string; isDark: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const tagContent = toolTag.replace(/^\[|\]$/g, "");

  return (
    <div
      className="my-1 rounded-lg overflow-hidden border text-xs font-mono select-none"
      style={{
        background: isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(241, 245, 249, 0.8)",
        borderColor: isDark ? "rgba(56, 189, 248, 0.2)" : "rgba(56, 189, 248, 0.3)",
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        className="px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-sky-500/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-sky-400 font-medium">
          <Zap size={13} className="animate-pulse" />
          <span>Tool Action Executed</span>
          <span className="text-[11px] opacity-75">({tagContent})</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 py-2 text-[11.5px] border-t"
            style={{
              borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
              background: isDark ? "#090D16" : "#F8FAFC",
              color: isDark ? "#94A3B8" : "#475569",
            }}
          >
            <code>{tagContent}</code>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MarkdownChunk({ text, isDark }: { text: string; isDark: boolean }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <span>{children}</span>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            style={{
              color: isDark ? "#E2E8F0" : "#1C1917",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
              textDecorationColor: isDark ? "rgba(226,232,240,0.4)" : "rgba(28,25,23,0.4)",
            }}
          >
            {children}
          </a>
        ),
        code: ({ children, className }: any) => {
          const isBlock = /language-/.test(className ?? "");
          if (isBlock) return <>{children}</>;
          return (
            <code
              style={{
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                padding: "1px 6px",
                borderRadius: "4px",
                fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                fontSize: "12.5px",
                color: isDark ? "#38BDF8" : "#0284C7",
              }}
            >
              {children}
            </code>
          );
        },
        pre: ({ children }: any) => {
          const codeText = extractCodeText(children);
          const langMatch = children?.props?.className?.match(/language-(\w+)/);
          const lang = langMatch ? langMatch[1] : "code";
          return <CodeBlock code={codeText} lang={lang} isDark={isDark} />;
        },
      }}
    >
      {linkifyText(text)}
    </ReactMarkdown>
  );
}

function extractCodeText(node: any): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractCodeText).join("");
  if (node?.props?.children) return extractCodeText(node.props.children);
  return "";
}

function linkifyText(text: string): string {
  return text.replace(/(?<!\]\()(https?:\/\/[^\s)]+)(?![^\[]*\])/g, "[$1]($1)");
}

// ChatGPT Codex / Claude Code Style Code & Diff Block
function CodeBlock({ code, lang, isDark }: { code: string; lang: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const [diffApplied, setDiffApplied] = useState<boolean | null>(null);

  const isDiff = lang === "diff" || code.startsWith("---") || code.includes("\n+") || code.includes("\n-");

  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div
      className="relative group my-4 rounded-xl overflow-hidden border shadow-sm"
      style={{
        background: isDark ? "#0B0F19" : "#18181B",
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)",
        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
      }}
    >
      {/* Code Header Bar */}
      <div
        className="px-4 py-2 flex items-center justify-between border-b text-xs select-none"
        style={{
          background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
          borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)",
          color: "#94A3B8",
        }}
      >
        <div className="flex items-center gap-2">
          <FileCode size={13} className="text-sky-400" />
          <span className="font-semibold uppercase tracking-wider text-[11px]" style={{ color: "#E2E8F0" }}>
            {lang}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isDiff && diffApplied === null && (
            <div className="flex items-center gap-1.5 mr-2">
              <button
                onClick={() => setDiffApplied(true)}
                className="px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
              >
                <CheckCircle2 size={11} />
                <span>Accept</span>
              </button>
              <button
                onClick={() => setDiffApplied(false)}
                className="px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
              >
                <XCircle size={11} />
                <span>Reject</span>
              </button>
            </div>
          )}

          {isDiff && diffApplied === true && (
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mr-2">
              <CheckCircle2 size={11} /> Applied
            </span>
          )}

          {isDiff && diffApplied === false && (
            <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-1 mr-2">
              <XCircle size={11} /> Rejected
            </span>
          )}

          <button
            onClick={copy}
            className="p-1 rounded hover:bg-white/10 text-slate-400 transition-colors flex items-center gap-1"
            title="Copy code"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span className="text-[11px]">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Code Body */}
      <pre
        className="overflow-x-auto p-4 text-[12.5px] leading-relaxed"
        style={{
          color: "#E2E8F0",
          margin: 0,
        }}
      >
        <code>
          {code.split("\n").map((line, idx) => {
            const isAdd = isDiff && line.startsWith("+");
            const isRemove = isDiff && line.startsWith("-");
            return (
              <div
                key={idx}
                className="px-1 py-0.5 rounded-sm font-mono flex"
                style={{
                  background: isAdd
                    ? "rgba(16, 185, 129, 0.15)"
                    : isRemove
                    ? "rgba(244, 63, 94, 0.15)"
                    : "transparent",
                  color: isAdd ? "#34D399" : isRemove ? "#F87171" : "#CBD5E1",
                }}
              >
                <span className="w-8 shrink-0 opacity-40 select-none text-right pr-3">{idx + 1}</span>
                <span className="flex-1 whitespace-pre">{line}</span>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

export function ChatMessage({
  message,
  previousUserPrompt = "",
  isDark,
  onRegenerate,
  onPreviewImage,
  onSaveToMemory,
  onDelete,
  onFeedback,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [downvoted, setDownvoted] = useState(false);

  const copyText = () => {
    navigator.clipboard.writeText(message.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleDownvote = () => {
    if (downvoted) return;
    setDownvoted(true);
    onFeedback?.({
      messageId: message.id,
      prompt: previousUserPrompt,
      response: message.text,
    });
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={`flex flex-col my-4 ${isUser ? "items-end" : "items-start"}`}
        >
          {/* User / Assistant Badge */}
          <div className="flex items-center gap-2 mb-1.5 px-1 select-none">
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: isDark ? "#94A3B8" : "#64748B",
                textTransform: "uppercase",
              }}
            >
              {isUser ? "You" : "Aethel Agent"}
            </span>
            <span style={{ fontSize: "10px", color: isDark ? "#64748B" : "#94A3B8" }}>
              {message.time}
            </span>
          </div>

          {/* Bubble container */}
          <div
            className="group relative max-w-[88%] rounded-2xl p-4 transition-all"
            style={{
              background: isUser
                ? isDark
                  ? "#1E293B"
                  : "#F1F5F9"
                : isDark
                ? "rgba(15, 23, 42, 0.75)"
                : "#FFFFFF",
              border: `1px solid ${
                isUser
                  ? isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.08)"
                  : isDark
                  ? "rgba(56, 189, 248, 0.15)"
                  : "rgba(0,0,0,0.08)"
              }`,
              boxShadow: isUser
                ? "none"
                : isDark
                ? "0 4px 20px rgba(0, 0, 0, 0.3)"
                : "0 2px 10px rgba(0, 0, 0, 0.04)",
              color: isDark ? "#F8FAFC" : "#0F172A",
              fontSize: "14px",
              lineHeight: 1.6,
            }}
          >
            {/* Message Body */}
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.text}</div>
            ) : (
              renderRosiaContent(message.text, isDark)
            )}

            {/* Generating placeholder card (shown before the image arrives) */}
            {message.imageLoading && !message.image && (
              <div
                className="mt-3 relative rounded-xl overflow-hidden"
                style={{ border: "1px solid var(--v-border)" }}
              >
                <div
                  className="h-56 w-full flex flex-col items-center justify-center gap-3 relative overflow-hidden"
                  style={{ background: "var(--v-surface-2)" }}
                >
                  {/* animated shimmer sweep */}
                  <div className="aethel-shimmer absolute inset-0" />
                  {/* pulsing camera glyph */}
                  <div
                    className="relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: "var(--v-accent-soft)", color: "var(--v-accent)" }}
                  >
                    <ImageIcon size={22} className="animate-pulse" />
                  </div>
                  <div className="relative z-10 flex flex-col items-center gap-1.5">
                    <span className="text-[13px] font-medium" style={{ color: "var(--v-text)" }}>
                      Creating your picture…
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--v-text-faint)" }}>
                      generating on-device · this can take a moment
                    </span>
                    <div className="flex gap-1 mt-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{
                            background: "var(--v-accent)",
                            animationDelay: `${i * 0.15}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Generated / uploaded image attachment */}
            {message.image && (
              <div
                className="mt-3 relative rounded-xl overflow-hidden group/img"
                style={{ border: "1px solid var(--v-border)" }}
              >
                <img
                  src={message.image}
                  alt="Attachment"
                  className="w-full max-h-96 object-cover cursor-pointer hover:scale-[1.01] transition-transform"
                  onClick={() => onPreviewImage(message.image!)}
                />
                <button
                  onClick={() => onPreviewImage(message.image!)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            )}

            {/* Quick Action Toolbar on hover */}
            <div
              className="absolute -bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1 p-1 rounded-lg border backdrop-blur-md shadow-md select-none"
              style={{
                background: isDark ? "#0F172A" : "#FFFFFF",
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
              }}
            >
              <button
                onClick={copyText}
                className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
                title="Copy message"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>

              {!isUser && onRegenerate && (
                <button
                  onClick={() => onRegenerate(message.id)}
                  className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Regenerate"
                >
                  <RefreshCw size={12} />
                </button>
              )}

              {onSaveToMemory && (
                <button
                  onClick={() => onSaveToMemory(message.id)}
                  className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Save to Memory"
                >
                  <BookmarkPlus size={12} />
                </button>
              )}

              {!isUser && onFeedback && (
                <button
                  onClick={handleDownvote}
                  disabled={downvoted}
                  className={`p-1 rounded transition-colors ${
                    downvoted
                      ? "text-rose-400 bg-rose-500/10"
                      : "hover:bg-slate-700/50 text-slate-400 hover:text-slate-200"
                  }`}
                  title="Downvote & feedback"
                >
                  <ThumbsDown size={12} />
                </button>
              )}

              {onDelete && (
                <button
                  onClick={() => onDelete(message.id)}
                  className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Delete message"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content
          className="min-w-[140px] rounded-xl p-1.5 shadow-xl text-xs font-medium border"
          style={{
            background: isDark ? "#0F172A" : "#FFFFFF",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            color: isDark ? "#F8FAFC" : "#0F172A",
          }}
        >
          <ContextMenu.Item
            onClick={copyText}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-sky-500/10 cursor-pointer outline-none"
          >
            <Copy size={13} />
            <span>Copy Text</span>
          </ContextMenu.Item>
          {onSaveToMemory && (
            <ContextMenu.Item
              onClick={() => onSaveToMemory(message.id)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-sky-500/10 cursor-pointer outline-none"
            >
              <BookmarkPlus size={13} />
              <span>Save to Memory</span>
            </ContextMenu.Item>
          )}
          {onDelete && (
            <ContextMenu.Item
              onClick={() => onDelete(message.id)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 cursor-pointer outline-none"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </ContextMenu.Item>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}