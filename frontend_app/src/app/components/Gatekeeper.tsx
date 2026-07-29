/**
 * Gatekeeper.tsx
 *
 * Simplified local-backend health gate. For the personal PC build, the backend
 * always runs on http://localhost:8000. This screen pings /status; on success it
 * immediately authorizes the session. On failure it shows an error with retry.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, WifiOff, CheckCircle2, Terminal } from "lucide-react";

const LOCAL_BACKEND = "http://localhost:8000";
const PING_INTERVAL_MS = 3000;

interface GatekeeperProps {
  onAuthorized: (sessionUrl: string) => void;
  isDark: boolean;
}

type ConnState = "connecting" | "connected" | "failed";

export function Gatekeeper({ onAuthorized, isDark }: GatekeeperProps) {
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [attempt, setAttempt] = useState(0);

  const bg = isDark ? "#060606" : "#FAFAF9";
  const card = isDark ? "#0E0E0E" : "#FFFFFF";
  const border = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const text = isDark ? "#E2E8F0" : "#1C1917";
  const muted = isDark ? "#71717A" : "#8E8781";
  const accent = "#38BDF8";

  const pingBackend = async () => {
    setConnState("connecting");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(`${LOCAL_BACKEND}/status`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        setConnState("connected");
        setTimeout(() => {
          onAuthorized(LOCAL_BACKEND);
        }, 600);
        return;
      }
    } catch {
      clearTimeout(timer);
    }
    setConnState("failed");
  };

  // Ping on mount and on each manual retry
  useEffect(() => {
    pingBackend();
  }, [attempt]);

  // Auto-retry every 3 s when in failed state
  useEffect(() => {
    if (connState !== "failed") return;
    const id = setInterval(() => setAttempt((n) => n + 1), PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [connState]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', 'Outfit', sans-serif",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={connState}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          style={{
            background: card,
            border: `1px solid ${border}`,
            borderRadius: 20,
            padding: "44px 48px",
            maxWidth: 420,
            width: "90vw",
            textAlign: "center",
            boxShadow: isDark
              ? "0 0 60px rgba(56,189,248,0.04), 0 20px 60px rgba(0,0,0,0.5)"
              : "0 20px 60px rgba(0,0,0,0.08)",
          }}
        >
          {/* Icon area */}
          <div style={{ marginBottom: 28 }}>
            {connState === "connecting" && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                style={{ display: "inline-block" }}
              >
                <Loader2 size={40} color={accent} />
              </motion.div>
            )}
            {connState === "connected" && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
              >
                <CheckCircle2 size={40} color="#34D399" />
              </motion.div>
            )}
            {connState === "failed" && (
              <WifiOff size={40} color="#F87171" />
            )}
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: text,
              margin: "0 0 10px",
              letterSpacing: "-0.3px",
            }}
          >
            {connState === "connecting" && "Connecting…"}
            {connState === "connected" && "Connected"}
            {connState === "failed" && "Backend Unreachable"}
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 14,
              color: muted,
              margin: "0 0 28px",
              lineHeight: 1.6,
            }}
          >
            {connState === "connecting" &&
              "Reaching the local AETHEL AI server."}
            {connState === "connected" &&
              "Local engine is running. Launching…"}
            {connState === "failed" &&
              "Could not reach the backend. Make sure the Python server is running, then retry."}
          </p>

          {/* Backend address pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: isDark ? "rgba(56,189,248,0.07)" : "rgba(56,189,248,0.1)",
              border: "1px solid rgba(56,189,248,0.2)",
              borderRadius: 8,
              padding: "8px 14px",
              marginBottom: connState === "failed" ? 24 : 0,
            }}
          >
            <Terminal size={14} color={accent} />
            <code style={{ fontSize: 13, color: accent, letterSpacing: "0.02em" }}>
              {LOCAL_BACKEND}
            </code>
          </div>

          {/* Retry button (only when failed) */}
          {connState === "failed" && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setAttempt((n) => n + 1)}
              style={{
                display: "block",
                width: "100%",
                padding: "13px 0",
                background: `linear-gradient(135deg, ${accent}, #818CF8)`,
                border: "none",
                borderRadius: 12,
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              Retry Connection
            </motion.button>
          )}

          {/* Auto-retry note */}
          {connState === "failed" && (
            <p style={{ fontSize: 12, color: muted, marginTop: 14 }}>
              Auto-retrying every {PING_INTERVAL_MS / 1000}s
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}