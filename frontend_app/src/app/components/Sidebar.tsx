import { motion } from "motion/react";
import { Sun, Moon, MessageSquare, Plus, Trash2, Settings, Database, Sliders } from "lucide-react";
import { AIAvatar } from "./AIAvatar";
import { Conversation } from "../App";

interface SidebarProps {
  isDark: boolean;
  toggleTheme: () => void;
  chemistry: number;
  mood: string;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  typing: boolean;
  audioAnalyser?: AnalyserNode | null;
  activeCompanionName?: string;
  onConfigurePersona?: () => void;
  onShowSettings?: () => void;
  onShowMemory?: () => void;
}

export function Sidebar({
  isDark,
  toggleTheme,
  chemistry,
  mood,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  typing,
  audioAnalyser = null,
  activeCompanionName = "Rosia",
  onConfigurePersona,
  onShowSettings,
  onShowMemory,
}: SidebarProps) {
  return (
    <aside
      className="w-[260px] shrink-0 flex flex-col"
      style={{
        background: isDark ? "#0A0A0A" : "#FAFAF9",
        borderRight: isDark
          ? "1px solid rgba(255,255,255,0.06)"
          : "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div className="px-6 pt-7 pb-3 flex items-center justify-between">
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "26px",
            fontWeight: 500,
            letterSpacing: "0.18em",
            color: isDark ? "#E2E8F0" : "#1C1917",
            lineHeight: 1,
          }}
        >
          VICES
        </h1>
      </div>

      {/* Dynamic 3D Face Wireframe Avatar */}
      <div className="flex justify-center items-center py-2 mb-2">
        <AIAvatar mood={mood} typing={typing} size={155} audioAnalyser={audioAnalyser} />
      </div>

      {/* Rosia Core status */}
      <div
        className="mx-3 mb-4 p-3 rounded-xl"
        style={{
          background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.025)",
          border: isDark
            ? "1px solid rgba(255,255,255,0.05)"
            : "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <motion.span
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2.6, repeat: Infinity }}
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "16px",
                color: isDark ? "#E2E8F0" : "#1C1917",
                filter: isDark
                  ? "drop-shadow(0 0 8px rgba(226,232,240,0.5))"
                  : "drop-shadow(0 0 6px rgba(28,25,23,0.25))",
                lineHeight: 1,
              }}
            >
              ✦
            </motion.span>
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "12px",
                fontWeight: 500,
                color: isDark ? "#E2E8F0" : "#1C1917",
                letterSpacing: "0.02em",
              }}
            >
              {activeCompanionName} Core
            </span>
          </div>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "10px",
              color: isDark ? "#71717A" : "#A8A29E",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {mood}
          </span>
        </div>
        {/* Chemistry meter */}
        <div className="flex items-center gap-2">
          <div
            className="flex-1 h-[3px] rounded-full overflow-hidden"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${chemistry}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full"
              style={{
                background: isDark
                  ? "linear-gradient(90deg, rgba(226,232,240,0.3), #E2E8F0)"
                  : "linear-gradient(90deg, rgba(28,25,23,0.3), #1C1917)",
              }}
            />
          </div>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "10px",
              color: isDark ? "#71717A" : "#A8A29E",
              minWidth: "26px",
              textAlign: "right",
            }}
          >
            {chemistry}%
          </span>
        </div>
      </div>

      {/* New conversation */}
      <button
        onClick={onNewConversation}
        className="mx-3 mb-2 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors hover:bg-white/[0.03] active:bg-white/[0.06] text-left"
        style={{
          color: isDark ? "#A1A1AA" : "#52525B",
          fontFamily: "'Inter', sans-serif",
          fontSize: "12.5px",
        }}
      >
        <Plus size={14} />
        <span>New conversation</span>
      </button>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-3">
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "10px",
            color: isDark ? "#52525B" : "#A8A29E",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            padding: "12px 8px 6px",
          }}
        >
          Recent
        </div>
        {conversations.map((c) => (
          <div
            key={c.id}
            className="w-full relative group mb-0.5 rounded-md flex items-center hover:bg-white/[0.02]"
          >
            <button
              onClick={() => onSelectConversation(c.id)}
              className="w-full px-3 py-2 flex items-center justify-between gap-2 transition-colors text-left"
              style={{
                background:
                  c.id === activeConversationId
                    ? isDark
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(0,0,0,0.04)"
                    : "transparent",
                borderRadius: "6px",
              }}
            >
              <div className="flex items-center gap-2 min-w-0 pr-6">
                <MessageSquare
                  size={12}
                  style={{
                    color:
                      c.id === activeConversationId
                        ? isDark
                          ? "#E2E8F0"
                          : "#1C1917"
                        : isDark
                        ? "#52525B"
                        : "#A8A29E",
                    flexShrink: 0,
                  }}
                />
                <span
                  className="truncate"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "12.5px",
                    color:
                      c.id === activeConversationId
                        ? isDark
                          ? "#E2E8F0"
                          : "#1C1917"
                        : isDark
                        ? "#A1A1AA"
                        : "#52525B",
                  }}
                >
                  {c.title || "Untitled Conversation"}
                </span>
              </div>
              <span
                className="group-hover:opacity-0 transition-opacity"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "10px",
                  color: isDark ? "#52525B" : "#A8A29E",
                  flexShrink: 0,
                }}
              >
                {c.time}
              </span>
            </button>
            
            {/* Delete button that shows on hover */}
            {conversations.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(c.id);
                }}
                className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-red-500/70 hover:text-red-500"
                title="Delete Conversation"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="px-3 py-3 flex items-center justify-between"
        style={{
          borderTop: isDark
            ? "1px solid rgba(255,255,255,0.05)"
            : "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={onConfigurePersona}
            className="p-1.5 rounded-md transition-colors flex items-center gap-1.5 hover:bg-white/[0.04]"
            style={{ color: isDark ? "#71717A" : "#78716C" }}
            title="Configure Persona"
          >
            <Settings size={14} />
          </button>

          <button
            onClick={onShowMemory}
            className="p-1.5 rounded-md transition-colors flex items-center gap-1.5 hover:bg-white/[0.04]"
            style={{ color: isDark ? "#71717A" : "#78716C" }}
            title="Memory Database Diagnostics"
          >
            <Database size={14} />
          </button>

          <button
            onClick={onShowSettings}
            className="p-1.5 rounded-md transition-colors flex items-center gap-1.5 hover:bg-white/[0.04]"
            style={{ color: isDark ? "#71717A" : "#78716C" }}
            title="Advanced System Config"
          >
            <Sliders size={14} />
          </button>
        </div>

        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md transition-colors flex items-center gap-1.5 hover:bg-white/[0.04]"
          style={{ color: isDark ? "#71717A" : "#78716C" }}
          title="Toggle theme"
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </aside>
  );
}

