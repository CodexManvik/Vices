import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, ArrowRight, Loader2 } from "lucide-react";

interface GatekeeperProps {
  onAuthorized: (sessionUrl: string) => void;
  onRequestAccess?: () => void;
  onBrokerUrlSet: (url: string) => void;
  isDark: boolean;
}

type Status = "idle" | "pinging" | "denied";

export function Gatekeeper({ onAuthorized, onRequestAccess, onBrokerUrlSet, isDark }: GatekeeperProps) {
  const [token, setToken] = useState("");
  const [brokerUrl, setBrokerUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [telemetry, setTelemetry] = useState(true);
  const [showBrokerInput, setShowBrokerInput] = useState(true);

  const handleConnect = async () => {
    if (!token.trim() || !brokerUrl.trim()) return;
    setStatus("pinging");
    
    try {
      // Use the user-provided broker URL instead of hardcoded
      const res = await fetch(`${brokerUrl.replace(/\/$/, '')}/request-access`, {
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

  if (showBrokerInput) {
    return (
      <div
        className="relative min-h-screen w-full flex items-center justify-center overflow-hidden"
        style={{
          background: isDark ? "#0A0A0A" : "#F5F5F4",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isDark
              ? "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.03) 0%, transparent 60%)"
              : "radial-gradient(circle at 50% 40%, rgba(0,0,0,0.03) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 w-full max-w-[340px] px-6 flex flex-col items-center">
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
              Enter Server Details
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="w-full flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: isDark ? "#A1A1AA" : "#52525B",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Broker URL
              </label>
              <input
                type="text"
                value={brokerUrl}
                onChange={(e) => setBrokerUrl(e.target.value)}
                placeholder="https://your-broker-tunnel.trycloudflare.com"
                className="w-full h-11 px-4 outline-none transition-all duration-300"
                style={{
                  background: isDark ? "#141414" : "#FFFFFF",
                  border: isDark
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid rgba(0,0,0,0.08)",
                  borderRadius: "12px",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "13px",
                  color: isDark ? "#E2E8F0" : "#1C1917",
                }}
              />
            </div>

            <button
              onClick={() => {
                onBrokerUrlSet(brokerUrl);
                setShowBrokerInput(false);
              }}
              className="group relative w-full h-11 flex items-center justify-center overflow-hidden rounded-xl transition-all duration-300"
              style={{
                background: isDark ? "#E2E8F0" : "#1C1917",
                color: isDark ? "#0A0A0A" : "#FFFFFF",
                boxShadow: isDark
                  ? "0 0 20px rgba(226,232,240,0.15)"
                  : "0 4px 12px rgba(0,0,0,0.1)",
              }}
              disabled={!brokerUrl.trim()}
            >
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                Continue
              </span>
            </button>

            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "10px",
                color: isDark ? "#52525B" : "#A8A29E",
                lineHeight: 1.6,
                textAlign: "center",
              }}
            >
              Ask the host for their broker tunnel URL (looks like https://xxx.trycloudflare.com)
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // Original login screen (with user-provided broker URL)
  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden"
      style={{
        background: isDark ? "#0A0A0A" : "#F5F5F4",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.03) 0%, transparent 60%)"
            : "radial-gradient(circle at 50% 40%, rgba(0,0,0,0.03) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[340px] px-6 flex flex-col items-center">
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

          <button
            onClick={() => setShowBrokerInput(true)}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "10px",
              color: isDark ? "#71717A" : "#A8A29E",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              textDecoration: "underline",
            }}
          >
            Change broker URL
          </button>
        </motion.div>

        <div
          className="mt-7 pt-5 flex flex-col items-center gap-1.5"
          style={{
            borderTop: isDark
              ? "1px solid rgba(255,255,255,0.04)"
              : "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <div
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
        </div>
      </div>
    </div>
  );
}