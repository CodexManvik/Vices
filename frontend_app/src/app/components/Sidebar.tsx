import { motion } from "motion/react";
import { Sun, Moon, MessageSquare, Sparkles, Settings, Plus } from "lucide-react";

interface SidebarProps {
  isDark: boolean;
  toggleTheme: () => void;
  chemistry: number;
  mood: string;
}

export function Sidebar({ isDark, toggleTheme, chemistry, mood }: SidebarProps) {
  const conversations = [
    { id: 1, title: "Late night thoughts", time: "Now", active: true },
    { id: 2, title: "Weekend in Lisbon", time: "Yesterday", active: false },
    { id: 3, title: "On reading Borges", time: "Mon", active: false },
    { id: 4, title: "First handshake", time: "May 12", active: false },
  ];

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
      <div className="px-6 pt-7 pb-5">
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
              Rosia Core
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
        className="mx-3 mb-2 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
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
          <button
            key={c.id}
            className="w-full px-3 py-2 mb-0.5 rounded-md flex items-center justify-between gap-2 transition-colors text-left group"
            style={{
              background: c.active
                ? isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"
                : "transparent",
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare
                size={12}
                style={{
                  color: c.active
                    ? isDark ? "#E2E8F0" : "#1C1917"
                    : isDark ? "#52525B" : "#A8A29E",
                  flexShrink: 0,
                }}
              />
              <span
                className="truncate"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "12.5px",
                  color: c.active
                    ? isDark ? "#E2E8F0" : "#1C1917"
                    : isDark ? "#A1A1AA" : "#52525B",
                }}
              >
                {c.title}
              </span>
            </div>
            <span
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
        <button
          className="p-1.5 rounded-md transition-colors"
          style={{ color: isDark ? "#71717A" : "#78716C" }}
          title="Settings"
        >
          <Settings size={14} />
        </button>

        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md transition-colors flex items-center gap-1.5"
          style={{ color: isDark ? "#71717A" : "#78716C" }}
          title="Toggle theme"
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </aside>
  );
}
