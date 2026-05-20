import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, ArrowRight, Loader2 } from "lucide-react";

interface GatekeeperProps {
  onAuthorized: (sessionUrl: string) => void;
  onRequestAccess?: () => void;
  isDark: boolean;
}

type Status = "idle" | "pinging" | "denied";

// Read broker URL from environment; fallback to localhost for development
const BROKER_URL = import.meta.env.VITE_BROKER_URL || "http://localhost:9000";

// Validate in production
if (!import.meta.env.DEV && !import.meta.env.VITE_BROKER_URL) {
  console.warn("Warning: VITE_BROKER_URL environment variable not set for production. Using localhost.");
} 

export function Gatekeeper({ onAuthorized, onRequestAccess, isDark }: GatekeeperProps) {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [telemetry, setTelemetry] = useState(true);

  const handleConnect = async () => {
    if (!token.trim()) return;
    setStatus("pinging");
    
    try {
      const res = await fetch(`${BROKER_URL}/request-access`, {
        method: "POST",
        headers: { 
          "x-tester-token": token,
          "ngrok-skip-browser-warning": "bypass"
        }
      });
      
      const data = await res.json();
      
      if (data.status === "allocated" && data.session_url) {
        const url = data.session_url.replace(/\/+$/, "").trim();
        if (url) {
          onAuthorized(url);
        } else {
          setStatus("denied");
          setTimeout(() => setStatus("idle"), 2500);
        }
      } else {
        setStatus("denied");
        setTimeout(() => setStatus("idle"), 2500);
      }
    } catch (e) {
      console.error("Broker connection failed", e);
      setStatus("denied");
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden"
      style={{
        background: isDark ? "#0A0A0A" : "#F5F5F4",
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.03) 0%, transparent 60%)"
            : "radial-gradient(circle at 50% 40%, rgba(0,0,0,0.03) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[340px] px-6 flex flex-col items-center">
        {/* Logo / Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center mb-10"
        >
          <div
            className="w-10 h-10 mb-5 flex items-center justify-center rounded-xl"
            style={{
              background: isDark ? "#141414" : "#FFFFFF",
              border: isDark
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(0,0,0,0.08)",
              boxShadow: isDark
                ? "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)"
                : "0 8px 24px rgba(0,0,0,0.06)",
            }}
          >
            <Lock size={16} color={isDark ? "#E2E8F0" : "#1C1917"} />
          </div>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "28px",
              color: isDark ? "#E2E8F0" : "#1C1917",
              letterSpacing: "0.1em",
            }}
          >
            VICES
          </h1>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "9px",
              color: isDark ? "#71717A" : "#A8A29E",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginTop: "4px",
            }}
          >
            Neural Architecture Auth
          </p>
        </motion.div>

        {/* Auth Input */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="w-full flex flex-col gap-3"
        >
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            placeholder="ENTER TESTER TOKEN"
            disabled={status === "pinging"}
            className="w-full h-11 px-4 text-center outline-none transition-all duration-300 disabled:opacity-50"
            style={{
              background: isDark ? "#141414" : "#FFFFFF",
              border:
                status === "denied"
                  ? "1px solid rgba(239,68,68,0.5)"
                  : isDark
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid rgba(0,0,0,0.08)",
              borderRadius: "12px",
              fontFamily: "'Inter', sans-serif",
              fontSize: "11px",
              letterSpacing: "0.15em",
              color: isDark ? "#E2E8F0" : "#1C1917",
              boxShadow: isDark
                ? "inset 0 1px 2px rgba(0,0,0,0.2)"
                : "inset 0 1px 2px rgba(0,0,0,0.02)",
            }}
          />

          <button
            onClick={handleConnect}
            disabled={!token.trim() || status === "pinging"}
            className="group relative w-full h-11 flex items-center justify-center overflow-hidden rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            style={{
              background: isDark ? "#E2E8F0" : "#1C1917",
              color: isDark ? "#0A0A0A" : "#FFFFFF",
              boxShadow: isDark
                ? "0 0 20px rgba(226,232,240,0.15)"
                : "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <AnimatePresence mode="wait">
              {status === "idle" && (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-2"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                  }}
                >
                  Connect to Core
                  <ArrowRight
                    size={12}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </motion.span>
              )}
              {status === "pinging" && (
                <motion.span
                  key="pinging"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                  }}
                >
                  <Loader2 size={12} className="animate-spin" />
                  Pinging Hardware...
                </motion.span>
              )}
              {status === "denied" && (
                <motion.span
                  key="denied"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    color: isDark ? "#EF4444" : "#DC2626",
                  }}
                >
                  Access Denied
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <button
            onClick={onRequestAccess}
            className="group relative w-full h-10 flex items-center justify-center overflow-hidden rounded-lg transition-all duration-300"
            style={{
              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
              color: isDark ? "#E2E8F0" : "#1C1917",
              border: isDark
                ? "1px solid rgba(255,255,255,0.12)"
                : "1px solid rgba(0,0,0,0.12)",
            }}
          >
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Request Access
            </span>
          </button>
        </motion.div>

        {/* Telemetry Toggle */}
        <div className="mt-8 flex items-center justify-between w-full px-2">
          <div className="flex flex-col gap-0.5">
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "11px",
                fontWeight: 500,
                color: isDark ? "#A1A1AA" : "#52525B",
              }}
            >
              Enable Core Telemetry
            </span>
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "9px",
                color: isDark ? "#52525B" : "#A8A29E",
                maxWidth: "200px",
                lineHeight: 1.4,
              }}
            >
              Share anonymous flow data to reduce hallucination rates.
            </span>
          </div>
          <button
            onClick={() => setTelemetry(!telemetry)}
            className="w-8 h-4 rounded-full relative transition-colors duration-300 shrink-0"
            style={{
              background: telemetry
                ? isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"
                : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
            }}
          >
            <motion.div
              layout
              className="absolute top-0.5 bottom-0.5 rounded-full"
              initial={false}
              animate={{
                left: telemetry ? "18px" : "2px",
                right: telemetry ? "2px" : "18px",
              }}
              style={{
                width: "14px",
                height: "14px",
                background: isDark ? "#E2E8F0" : "#FAFAF9",
                boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
              }}
            />
          </button>
        </div>

        {/* Project VICES footer */}
        <div
          className="mt-7 pt-5 flex flex-col items-center gap-1.5"
          style={{
            borderTop: isDark
              ? "1px solid rgba(255,255,255,0.04)"
              : "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <div
            className="text-center"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "9px",
              color: isDark ? "#52525B" : "#A8A29E",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Real-time Web Search · Generative Voice · Image Synthesis · Autonomous Memory
          </div>
          <div
            className="text-center max-w-[320px]"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "10px",
              color: isDark ? "#52525B" : "#A8A29E",
              lineHeight: 1.5,
              opacity: 0.85,
              marginTop: "4px",
            }}
          >
            All conversational data remains completely private. Generated media and selfies are fully synthetic and not based on real individuals.
          </div>
        </div>
      </div>
    </div>
  );
}