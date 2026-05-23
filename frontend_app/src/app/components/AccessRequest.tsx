import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Copy, Check, AlertCircle, Clock } from "lucide-react";

interface AccessRequestProps {
  isDark: boolean;
  onBack: () => void;
  brokerUrl: string;
}

type RequestStatus = "idle" | "requesting" | "denied" | "waitlisted" | "approved";

export function AccessRequest({ isDark, onBack, brokerUrl }: AccessRequestProps) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [approvalToken, setApprovalToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const handleRequestAccess = async () => {
    if (!name.trim()) return;
    setStatus("requesting");

    try {
      const cleanUrl = brokerUrl.replace(/\/+$/, "");
      const res = await fetch(`${cleanUrl}/request-waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "bypass",
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();

      if (data.status === "denied") {
        setStatus("denied");
      } else if (data.status === "waitlisted" || data.status === "pending") {
        setStatus("waitlisted");
        setRequestId(data.request_id);
        // Start polling for approval
        const interval = setInterval(async () => {
          try {
            const pollRes = await fetch(`${cleanUrl}/check-approval`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "bypass",
              },
              body: JSON.stringify({ request_id: data.request_id }),
            });

            const pollData = await pollRes.json();
            if (pollData.status === "approved" && pollData.token) {
              setStatus("approved");
              setApprovalToken(pollData.token);
              if (interval) clearInterval(interval);
            }
          } catch (err) {
            console.error("Poll failed:", err);
          }
        }, 2000);
        setPollInterval(interval);
      } else if (data.status === "approved" && data.token) {
        setStatus("approved");
        setApprovalToken(data.token);
      }
    } catch (e) {
      console.error("Request failed:", e);
      setStatus("denied");
    }
  };

  const handleCopyToken = () => {
    if (approvalToken) {
      navigator.clipboard.writeText(approvalToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  return (
    <div
      className="relative min-h-screen w-full flex flex-col overflow-hidden"
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

      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        onClick={onBack}
        className="absolute top-6 left-6 z-50 p-2 rounded-lg transition-all duration-200 hover:bg-white/5 active:bg-white/10"
        style={{
          color: isDark ? "#E2E8F0" : "#1C1917",
        }}
        title="Back"
      >
        <ArrowLeft size={20} />
      </motion.button>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center mb-12"
          >
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "32px",
                color: isDark ? "#E2E8F0" : "#1C1917",
                letterSpacing: "0.1em",
                marginBottom: "8px",
              }}
            >
              REQUEST ACCESS
            </h1>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "11px",
                color: isDark ? "#71717A" : "#A8A29E",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              Join the Waitlist
            </p>
          </motion.div>

          {/* Content Container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="w-full flex flex-col gap-6"
          >
            <AnimatePresence mode="wait">
              {/* Idle State - Name Input */}
              {status === "idle" && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
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
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRequestAccess()}
                      placeholder="Enter your name"
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
                        boxShadow: isDark
                          ? "inset 0 1px 2px rgba(0,0,0,0.2)"
                          : "inset 0 1px 2px rgba(0,0,0,0.02)",
                      }}
                    />
                  </div>

                  <button
                    onClick={handleRequestAccess}
                    disabled={!name.trim()}
                    className="group relative w-full h-11 flex items-center justify-center overflow-hidden rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                    style={{
                      background: isDark ? "#E2E8F0" : "#1C1917",
                      color: isDark ? "#0A0A0A" : "#FFFFFF",
                      boxShadow: isDark
                        ? "0 0 20px rgba(226,232,240,0.15)"
                        : "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                      }}
                    >
                      Request Access
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
                    Your request will be reviewed by our team. Check back here for updates.
                  </p>
                </motion.div>
              )}

              {/* Requesting State - Loading */}
              {status === "requesting" && (
                <motion.div
                  key="requesting"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full flex flex-col items-center gap-6 py-8"
                >
                  <div className="w-16 h-16 flex items-center justify-center rounded-full" style={{
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                  }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Clock size={24} color={isDark ? "#E2E8F0" : "#1C1917"} />
                    </motion.div>
                  </div>
                  <p
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: "13px",
                      color: isDark ? "#E2E8F0" : "#1C1917",
                      fontWeight: 500,
                    }}
                  >
                    Submitting your request...
                  </p>
                </motion.div>
              )}

              {/* Denied State */}
              {status === "denied" && (
                <motion.div
                  key="denied"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full flex flex-col items-center gap-6 py-8"
                >
                  <div className="w-16 h-16 flex items-center justify-center rounded-full" style={{
                    background: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.1)",
                  }}>
                    <AlertCircle size={24} color={isDark ? "#EF4444" : "#DC2626"} />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "16px",
                        color: isDark ? "#EF4444" : "#DC2626",
                        fontWeight: 600,
                      }}
                    >
                      Access Denied
                    </p>
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "11px",
                        color: isDark ? "#A1A1AA" : "#71717A",
                        textAlign: "center",
                        lineHeight: 1.5,
                      }}
                    >
                      Unfortunately, your request has been denied. Please contact support for more information.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setStatus("idle");
                      setName("");
                    }}
                    className="group relative w-full h-10 flex items-center justify-center overflow-hidden rounded-lg transition-all duration-300"
                    style={{
                      background: isDark ? "#E2E8F0" : "#1C1917",
                      color: isDark ? "#0A0A0A" : "#FFFFFF",
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
                      Try Again
                    </span>
                  </button>
                </motion.div>
              )}

              {/* Waitlisted State */}
              {status === "waitlisted" && (
                <motion.div
                  key="waitlisted"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full flex flex-col items-center gap-6 py-8"
                >
                  <div className="w-16 h-16 flex items-center justify-center rounded-full" style={{
                    background: isDark ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.1)",
                  }}>
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Clock size={24} color={isDark ? "#FBBF24" : "#F59E0B"} />
                    </motion.div>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "16px",
                        color: isDark ? "#FBBF24" : "#F59E0B",
                        fontWeight: 600,
                      }}
                    >
                      Added to Waitlist
                    </p>
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "11px",
                        color: isDark ? "#A1A1AA" : "#71717A",
                        textAlign: "center",
                        lineHeight: 1.6,
                      }}
                    >
                      Your request has been submitted successfully. Our team is reviewing it. Check back soon for updates!
                    </p>
                  </div>
                  <div
                    className="w-full p-4 rounded-lg flex items-center gap-2"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.05)"
                        : "1px solid rgba(0,0,0,0.05)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "10px",
                        color: isDark ? "#71717A" : "#A8A29E",
                        wordBreak: "break-all",
                      }}
                    >
                      Name: <strong>{name}</strong>
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Approved State - Show Token */}
              {status === "approved" && approvalToken && (
                <motion.div
                  key="approved"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full flex flex-col items-center gap-6 py-8"
                >
                  <div className="w-16 h-16 flex items-center justify-center rounded-full" style={{
                    background: isDark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.1)",
                  }}>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    >
                      <Check size={24} color={isDark ? "#22C55E" : "#16A34A"} />
                    </motion.div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "16px",
                        color: isDark ? "#22C55E" : "#16A34A",
                        fontWeight: 600,
                      }}
                    >
                      Access Approved!
                    </p>
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "11px",
                        color: isDark ? "#A1A1AA" : "#71717A",
                        textAlign: "center",
                        lineHeight: 1.5,
                      }}
                    >
                      Congratulations! Your access has been approved. Copy your token below and paste it on the login screen.
                    </p>
                  </div>

                  {/* Token Display Box */}
                  <button
                    onClick={handleCopyToken}
                    className="w-full relative overflow-hidden rounded-lg transition-all duration-300 hover:shadow-lg"
                    style={{
                      background: isDark ? "#141414" : "#FFFFFF",
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.1)"
                        : "1px solid rgba(0,0,0,0.1)",
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background: isDark
                          ? "linear-gradient(135deg, rgba(34,197,94,0.1), transparent)"
                          : "linear-gradient(135deg, rgba(34,197,94,0.05), transparent)",
                      }}
                    />
                    <div className="relative p-4 flex items-center gap-3 justify-between">
                      <div className="flex-1 text-left">
                        <p
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: "9px",
                            color: isDark ? "#71717A" : "#A8A29E",
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            marginBottom: "6px",
                          }}
                        >
                          Your Tester Token
                        </p>
                        <p
                          style={{
                            fontFamily: "'Courier New', monospace",
                            fontSize: "12px",
                            color: isDark ? "#E2E8F0" : "#1C1917",
                            wordBreak: "break-all",
                            fontWeight: 500,
                            letterSpacing: "0.05em",
                          }}
                        >
                          {approvalToken}
                        </p>
                      </div>
                      <AnimatePresence mode="wait">
                        {copied ? (
                          <motion.div
                            key="check"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="shrink-0"
                          >
                            <Check size={20} color={isDark ? "#22C55E" : "#16A34A"} />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="copy"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="shrink-0"
                          >
                            <Copy size={20} color={isDark ? "#A1A1AA" : "#71717A"} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </button>

                  {/* Instructions */}
                  <div
                    className="w-full p-4 rounded-lg"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.05)"
                        : "1px solid rgba(0,0,0,0.05)",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "10px",
                        color: isDark ? "#A1A1AA" : "#71717A",
                        lineHeight: 1.8,
                      }}
                    >
                      <strong>Next step:</strong> Click the back arrow to return to the login screen, then paste this token in the "ENTER TESTER TOKEN" field and click "Connect to Core".
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
