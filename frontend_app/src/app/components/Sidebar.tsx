/**
 * Sidebar.tsx — app navigation rail.
 * Styled entirely with the --v-* design tokens (see styles/theme.css), so it
 * adapts to dark/light automatically. The old THREE.js face mesh is replaced
 * by a lightweight CSS presence orb that breathes while the agent speaks.
 */

import { motion } from "motion/react";
import {
  Sun,
  Moon,
  MessageSquare,
  Plus,
  Trash2,
  Settings,
  Database,
  Sliders,
  Sparkles,
} from "lucide-react";
import { Conversation } from "../App";

interface SidebarProps {
  isDark: boolean;
  toggleTheme: () => void;
  toneEnabled?: boolean;
  mood: string;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  typing: boolean;
  activeCompanionName?: string;
  onConfigurePersona?: () => void;
  onShowSettings?: () => void;
  onShowMemory?: () => void;
}

// Conversation tone states produced by the backend tone engine
// (mood × energy). Only shown when the tone engine is enabled.
const MOOD_COLORS: Record<string, string> = {
  neutral: "#7c5cff",
  positive: "#fbbf24",
  warm: "#f59e0b",
  enthusiastic: "#ec4899",
  calm: "#38bdf8",
  relaxed: "#a78bfa",
  guarded: "#94a3b8",
  tense: "#f43f5e",
  downcast: "#3b82f6",
  flat: "#6b7280",
};

/**
 * Compact status dot. Replaces the old animated orb — a quiet indicator
 * reads better next to text than a decorative sphere, and the tone colour
 * now lives around the prompt box where the user is actually looking.
 */
function StatusDot({ mood, typing }: { mood: string; typing: boolean }) {
  const color = MOOD_COLORS[mood?.toLowerCase()] || "var(--v-accent)";
  return (
    <span className="relative flex w-2.5 h-2.5 shrink-0" aria-hidden="true">
      {typing && (
        <motion.span
          className="absolute inline-flex w-full h-full rounded-full"
          style={{ background: color }}
          animate={{ scale: [1, 2.1], opacity: [0.5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <span
        className="relative inline-flex w-2.5 h-2.5 rounded-full"
        style={{
          background: color,
          boxShadow: `0 0 8px ${typing ? color : "transparent"}`,
          transition: "background var(--v-dur-slow) var(--v-ease), box-shadow var(--v-dur) var(--v-ease)",
        }}
      />
    </span>
  );
}

export function Sidebar({
  isDark,
  toggleTheme,
  toneEnabled = false,
  mood,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  typing,
  activeCompanionName = "Rosia",
  onConfigurePersona,
  onShowSettings,
  onShowMemory,
}: SidebarProps) {
  const moodColor = MOOD_COLORS[mood?.toLowerCase()] || "var(--v-accent)";

  return (
    <aside
      className="w-[268px] shrink-0 flex flex-col h-full"
      style={{
        background: "var(--v-sidebar)",
        borderRight: "1px solid var(--v-border)",
        color: "var(--v-text)",
      }}
    >
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 flex items-center gap-2.5 select-none">
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center"
          style={{ background: "var(--v-accent)", color: "var(--v-accent-contrast)" }}
        >
          <Sparkles size={16} strokeWidth={2.2} />
        </div>
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-[0.14em]">VICES</div>
          <div className="text-[10px] mt-1" style={{ color: "var(--v-text-faint)" }}>
            Local AI Agent
          </div>
        </div>
      </div>

      {/* Agent status */}
      <div
        className="mx-3 mb-3 px-3 py-2.5 rounded-[var(--v-radius)] flex items-center gap-2.5"
        style={{ background: "var(--v-surface-2)", border: "1px solid var(--v-border)" }}
      >
        <StatusDot mood={toneEnabled ? mood : ""} typing={typing} />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold truncate leading-tight">
            {activeCompanionName}
          </div>
          <div className="text-[10.5px] mt-0.5 truncate" style={{ color: "var(--v-text-faint)" }}>
            {typing ? "responding…" : toneEnabled && mood ? mood : "ready"}
          </div>
        </div>
      </div>

      {/* New conversation */}
      <div className="px-3 mb-1">
        <button
          onClick={onNewConversation}
          className="w-full px-3 py-2.5 rounded-[var(--v-radius-sm)] flex items-center gap-2 text-[13px] font-medium transition-all hover:brightness-110 active:scale-[0.99] cursor-pointer"
          style={{
            background: "var(--v-accent-soft)",
            color: "var(--v-accent)",
            border: "1px solid transparent",
          }}
        >
          <Plus size={15} strokeWidth={2.4} />
          <span>New conversation</span>
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-0">
        <div
          className="text-[10px] uppercase tracking-[0.11em] px-2 pt-3 pb-1.5 select-none"
          style={{ color: "var(--v-text-faint)" }}
        >
          Recent
        </div>
        {conversations.map((c) => {
          const active = c.id === activeConversationId;
          return (
            <div key={c.id} className="relative group mb-0.5">
              <button
                onClick={() => onSelectConversation(c.id)}
                className="w-full px-2.5 py-2 rounded-[var(--v-radius-sm)] flex items-center gap-2.5 text-left transition-colors cursor-pointer"
                style={{
                  background: active ? "var(--v-surface-2)" : "transparent",
                  color: active ? "var(--v-text)" : "var(--v-text-muted)",
                }}
              >
                <MessageSquare
                  size={13}
                  style={{ color: active ? "var(--v-accent)" : "var(--v-text-faint)", flexShrink: 0 }}
                />
                <span className="truncate flex-1 text-[12.5px]">
                  {c.title || "Untitled conversation"}
                </span>
                <span
                  className="text-[10px] shrink-0 group-hover:opacity-0 transition-opacity"
                  style={{ color: "var(--v-text-faint)" }}
                >
                  {c.time}
                </span>
              </button>
              {conversations.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(c.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md cursor-pointer"
                  style={{ color: "var(--v-danger)" }}
                  title="Delete conversation"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div
        className="px-3 py-2.5 flex items-center justify-between"
        style={{ borderTop: "1px solid var(--v-border)" }}
      >
        <div className="flex items-center gap-0.5">
          {onConfigurePersona && (
            <button
              onClick={onConfigurePersona}
              className="p-2 rounded-[var(--v-radius-sm)] transition-colors cursor-pointer hover:bg-[var(--v-surface-2)]"
              style={{ color: "var(--v-text-muted)" }}
              title="Personas"
            >
              <Settings size={15} />
            </button>
          )}
          {onShowMemory && (
            <button
              onClick={onShowMemory}
              className="p-2 rounded-[var(--v-radius-sm)] transition-colors cursor-pointer hover:bg-[var(--v-surface-2)]"
              style={{ color: "var(--v-text-muted)" }}
              title="Memory"
            >
              <Database size={15} />
            </button>
          )}
          {onShowSettings && (
            <button
              onClick={onShowSettings}
              className="p-2 rounded-[var(--v-radius-sm)] transition-colors cursor-pointer hover:bg-[var(--v-surface-2)]"
              style={{ color: "var(--v-text-muted)" }}
              title="Settings"
            >
              <Sliders size={15} />
            </button>
          )}
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-[var(--v-radius-sm)] transition-colors cursor-pointer hover:bg-[var(--v-surface-2)]"
          style={{ color: "var(--v-text-muted)" }}
          title="Toggle theme"
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </aside>
  );
}
