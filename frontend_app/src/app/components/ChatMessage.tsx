import { useState } from "react";
import { motion } from "motion/react";
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
  Camera,
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
  const cleanedText = text.replace(/\[(TRIGGER_SELFIE|CALL_TOOL)[^\]]*\]?/gi, "");
  const parts = cleanedText.split(/(\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <span
          key={i}
          className="inline-block px-2.5 py-0.5 mx-0.5 rounded-md italic align-baseline transition-all duration-300 hover:scale-[1.02] hover:bg-opacity-20 cursor-default"
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
          {part.slice(1, -1)}
        </span>
      );
    }
    return <MarkdownChunk key={i} text={part} isDark={isDark} />;
  });
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
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
                padding: "1px 6px",
                borderRadius: "4px",
                fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                fontSize: "12.5px",
                color: isDark ? "#E2E8F0" : "#1C1917",
              }}
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => {
          const codeText = extractCodeText(children);
          return <CodeBlock code={codeText} isDark={isDark} />;
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

// Auto-linkify bare URLs
function linkifyText(text: string): string {
  return text.replace(/(?<!\]\()(https?:\/\/[^\s)]+)(?![^\[]*\])/g, "[$1]($1)");
}

// Fixed missing curly bracket from source parsing trace
function CodeBlock({ code, isDark }: { code: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div
      className="relative group my-3 rounded-lg overflow-hidden"
      style={{
        background: "#141414",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
          color: "#A1A1AA",
        }}
        title="Copy code"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
      <pre
        className="overflow-x-auto p-4"
        style={{
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
          fontSize: "12.5px",
          lineHeight: 1.65,
          color: "#A1A1AA",
          margin: 0,
        }}
      >
        <code>{code}</code>
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

  const messageBody = (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-7 group`}
    >
      <div className={`max-w-[640px] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {!isUser && (
          <div
            className="flex items-center gap-2 mb-2"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "11px",
              color: isDark ? "#52525B" : "#A8A29E",
              letterSpacing: "0.04em",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: isDark
                  ? "linear-gradient(135deg, rgba(56,189,248,0.3), rgba(6,182,212,0.2))"
                  : "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(6,182,212,0.15))",
                border: isDark
                  ? "1px solid rgba(56,189,248,0.25)"
                  : "1px solid rgba(6,182,212,0.2)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "7px",
                color: isDark ? "#38BDF8" : "#0891B2",
                flexShrink: 0,
              }}
            >
              ✦
            </span>
            <span>Rosia</span>
            <span style={{ opacity: 0.6 }}>·</span>
            <span style={{ opacity: 0.7 }}>{message.time}</span>
          </div>
        )}

        {/* Text body */}
        {message.text && (
          <div
            style={
              isUser
                ? {
                    background: isDark ? "#141414" : "#FFFFFF",
                    border: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.06)",
                    color: isDark ? "#E2E8F0" : "#1C1917",
                    borderRadius: "14px",
                    padding: "10px 16px",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "14.5px",
                    lineHeight: 1.55,
                  }
                : {
                    color: isDark ? "#E2E8F0" : "#1C1917",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "15px",
                    lineHeight: 1.65,
                    background: "transparent",
                  }
            }
          >
            {isUser ? (
              <UserText text={message.text} isDark={isDark} />
            ) : (
              renderRosiaContent(message.text, isDark)
            )}
          </div>
        )}

        {/* Media Frame Anchor with Inspection Overlay Hooks */}
        {(message.image || message.imageLoading) && (
          <div
            className="mt-3 relative overflow-hidden rounded-xl border group/img select-none"
            style={{
              borderColor: isDark ? "rgba(226,232,240,0.15)" : "rgba(28,25,23,0.1)",
              boxShadow: isDark ? "0 24px 60px rgba(0,0,0,0.55)" : "0 14px 36px rgba(0,0,0,0.14)",
              width: "320px",
              maxWidth: "100%",
            }}
          >
            {message.imageLoading ? (
              <div
                className="relative w-full overflow-hidden flex flex-col items-center justify-center gap-4"
                style={{
                  aspectRatio: "4/3",
                  background: isDark 
                    ? "radial-gradient(circle at center, rgba(168, 85, 247, 0.08) 0%, #0A0A0A 80%)" 
                    : "radial-gradient(circle at center, rgba(126, 58, 242, 0.05) 0%, #F5F5F4 80%)",
                  border: isDark ? "1px solid rgba(168, 85, 247, 0.15)" : "1px solid rgba(126, 58, 242, 0.12)",
                  borderRadius: "12px",
                }}
              >
                {/* Scanner Beam Animation */}
                <motion.div
                  className="absolute left-0 right-0 h-[2px] z-10 opacity-60"
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    background: "linear-gradient(90deg, transparent, #C084FC, transparent)",
                    boxShadow: "0 0 8px #C084FC",
                  }}
                />

                {/* Shimmer Effect */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                  style={{
                    background: isDark
                      ? "linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.03), transparent)"
                      : "linear-gradient(90deg, transparent, rgba(126, 58, 242, 0.03), transparent)",
                  }}
                />

                {/* Animated Camera Icon */}
                <motion.div
                  animate={{ 
                    scale: [0.95, 1.05, 0.95],
                    rotate: [0, 2, -2, 0]
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="p-4 rounded-full flex items-center justify-center"
                  style={{
                    background: isDark ? "rgba(168, 85, 247, 0.06)" : "rgba(126, 58, 242, 0.04)",
                    border: isDark ? "1px solid rgba(168, 85, 247, 0.2)" : "1px solid rgba(126, 58, 242, 0.15)",
                    boxShadow: isDark ? "0 0 20px rgba(168, 85, 247, 0.1)" : "none",
                  }}
                >
                  <Camera 
                    className="w-10 h-10" 
                    style={{ 
                      color: isDark ? "#C084FC" : "#7E3AF2",
                      filter: isDark ? "drop-shadow(0 0 8px rgba(168,85,247,0.5))" : "none"
                    }} 
                  />
                </motion.div>

                {/* Status Message */}
                <div className="flex flex-col items-center gap-1.5 z-20">
                  <motion.span 
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="text-xs uppercase font-mono tracking-widest font-semibold"
                    style={{ color: isDark ? "#C084FC" : "#7E3AF2" }}
                  >
                    Taking a pic...
                  </motion.span>
                  <span className="text-[10px] opacity-50" style={{ color: isDark ? "#A1A1AA" : "#78716C" }}>
                    synthesizing digital memory
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-auto cursor-pointer">
                <img src={message.image} alt="AI Generated Output" className="block w-full h-auto transition-transform duration-300 group-hover/img:scale-[1.015]" />
                
                {/* Custom Overlay Controls */}
                <div 
                  onClick={() => onPreviewImage(message.image!)}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity duration-200"
                >
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
                    <Maximize2 className="w-3 text-cyan-400" />
                    <span className="text-[10px] text-white font-mono uppercase tracking-wider">Inspect Canvas</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!isUser && message.text && (
          <div className="mt-2 flex items-center gap-2 h-5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={copyText}
              className="p-1 rounded transition-colors"
              style={{ color: isDark ? "#52525B" : "#A8A29E" }}
              title="Copy"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
            <motion.button
              onClick={handleDownvote}
              whileTap={{ scale: 0.85 }}
              animate={
                downvoted
                  ? {
                      color: isDark ? "#E2E8F0" : "#1C1917",
                      filter: isDark ? "drop-shadow(0 0 6px rgba(226,232,240,0.6))" : "drop-shadow(0 0 4px rgba(28,25,23,0.3))",
                    }
                  : {
                      color: isDark ? "#52525B" : "#A8A29E",
                      filter: "drop-shadow(0 0 0 transparent)",
                    }
              }
              transition={{ duration: 0.4 }}
              className="p-1 rounded"
              title="Not helpful"
            >
              <ThumbsDown size={11} fill={downvoted ? "currentColor" : "none"} />
            </motion.button>
          </div>
        )}

        {isUser && (
          <div
            className="mt-1.5 mr-1"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "10.5px",
              color: isDark ? "#52525B" : "#A8A29E",
            }}
          >
            {message.time}
          </div>
        )}
      </div>
    </motion.div>
  );

  if (isUser) return messageBody;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{messageBody}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="min-w-[200px] rounded-lg p-1 z-50"
          style={{
            background: isDark ? "rgba(20,20,20,0.92)" : "rgba(255,255,255,0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
          }}
        >
          <MenuItem isDark={isDark} icon={<Copy size={12} />} label="Copy Text" onSelect={copyText} />
          <MenuItem
            isDark={isDark}
            icon={<RefreshCw size={12} />}
            label="Regenerate Response"
            onSelect={() => onRegenerate?.(message.id)}
          />
          <MenuItem
            isDark={isDark}
            icon={<BookmarkPlus size={12} />}
            label="Save to Memory"
            onSelect={() => onSaveToMemory?.(message.id)}
          />
          <div
            className="my-1 h-px"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
          />
          <MenuItem
            isDark={isDark}
            icon={<Trash2 size={12} />}
            label="Delete Message"
            onSelect={() => onDelete?.(message.id)}
            destructive
          />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function MenuItem({
  icon,
  label,
  onSelect,
  isDark,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
  isDark: boolean;
  destructive?: boolean;
}) {
  return (
    <ContextMenu.Item
      onSelect={onSelect}
      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md outline-none cursor-default transition-colors data-[highlighted]:bg-white/[0.06]"
      style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: "12.5px",
        color: destructive ? "#F87171" : isDark ? "#E2E8F0" : "#1C1917",
      }}
    >
      <span style={{ opacity: 0.75 }}>{icon}</span>
      <span>{label}</span>
    </ContextMenu.Item>
  );
}

function UserText({ text, isDark }: { text: string; isDark: boolean }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noreferrer"
            style={{
              color: isDark ? "#E2E8F0" : "#1C1917",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}