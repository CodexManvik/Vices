import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, CheckCircle, XCircle, Clock, Copy, Check, Loader2, Lock, Eye, EyeOff } from "lucide-react";

interface Request {
  id: string;
  name: string;
  ip: string;
  timestamp: string;
  status: "pending" | "approved" | "denied" | "waitlisted";
  token?: string;
}

interface AdminDashboardProps {
  isDark: boolean;
  onBack: () => void;
}

const BROKER_URL = import.meta.env.VITE_BROKER_URL || "http://localhost:9000";

// Token generation function
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return "vx_" + Array.from(array)
    .map((x) => chars[x % chars.length])
    .join("")
    .slice(0, 32);
}

export function AdminDashboard({ isDark, onBack }: AdminDashboardProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

  // Fetch pending requests
  const fetchRequests = async (adminPassword: string) => {
    try {
      const res = await fetch(`${BROKER_URL}/admin/requests`, {
        method: "GET",
        headers: {
          "ngrok-skip-browser-warning": "bypass",
          "password": adminPassword,
        },
      });

      if (res.status === 401) {
        setAuthenticated(false);
        setPassword("");
        setPasswordError("Invalid password. Access denied.");
        return;
      }

      const data = await res.json();
      if (Array.isArray(data.requests)) {
        setRequests(data.requests);
      }
    } catch (e) {
      console.error("Failed to fetch requests:", e);
    } finally {
      setLoading(false);
    }
  };

  // Handle admin login
  const handleLogin = async () => {
    if (!password.trim()) {
      setPasswordError("Password is required");
      return;
    }

    setAuthenticating(true);
    setPasswordError("");

    try {
      const res = await fetch(`${BROKER_URL}/admin/requests`, {
        method: "GET",
        headers: {
          "ngrok-skip-browser-warning": "bypass",
          "password": password,
        },
      });

      if (res.status === 401) {
        setPasswordError("Invalid password. Please try again.");
        setAuthenticating(false);
        return;
      }

      setAuthenticated(true);
      await fetchRequests(password);
    } catch (e) {
      console.error("Login error:", e);
      setPasswordError("Connection error. Please try again.");
    } finally {
      setAuthenticating(false);
    }
  };

  // Handle approve
  const handleApprove = async (id: string, name: string) => {
    setProcessingId(id);
    const token = generateToken();

    try {
      const res = await fetch(`${BROKER_URL}/admin/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "bypass",
          "password": password,
        },
        body: JSON.stringify({ request_id: id, token }),
      });

      if (res.ok) {
        setRequests((prev) =>
          prev.map((req) =>
            req.id === id
              ? { ...req, status: "approved", token }
              : req
          )
        );
      }
    } catch (e) {
      console.error("Failed to approve:", e);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle deny
  const handleDeny = async (id: string) => {
    setProcessingId(id);

    try {
      const res = await fetch(`${BROKER_URL}/admin/deny`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "bypass",
          "password": password,
        },
        body: JSON.stringify({ request_id: id }),
      });

      if (res.ok) {
        setRequests((prev) =>
          prev.map((req) =>
            req.id === id
              ? { ...req, status: "denied" }
              : req
          )
        );
      }
    } catch (e) {
      console.error("Failed to deny:", e);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle waitlist
  const handleWaitlist = async (id: string) => {
    setProcessingId(id);

    try {
      const res = await fetch(`${BROKER_URL}/admin/waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "bypass",
          "password": password,
        },
        body: JSON.stringify({ request_id: id }),
      });

      if (res.ok) {
        setRequests((prev) =>
          prev.map((req) =>
            req.id === id
              ? { ...req, status: "waitlisted" }
              : req
          )
        );
      }
    } catch (e) {
      console.error("Failed to add to waitlist:", e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCopyToken = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  useEffect(() => {
    if (authenticated) {
      fetchRequests(password);
      // Auto-refresh every 5 seconds only if authenticated
      const interval = setInterval(() => fetchRequests(password), 5000);
      setRefreshInterval(interval);

      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [authenticated]);

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status === "approved");
  const deniedRequests = requests.filter((r) => r.status === "denied");
  const waitlistedRequests = requests.filter((r) => r.status === "waitlisted");

  // Login Modal
  if (!authenticated) {
    return (
      <div
        className="relative min-h-screen w-full flex items-center justify-center"
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

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 max-w-md w-full mx-4"
        >
          <div
            className="rounded-lg p-8 backdrop-blur-sm"
            style={{
              background: isDark ? "rgba(20, 20, 20, 0.8)" : "rgba(255, 255, 255, 0.8)",
              border: isDark
                ? "1px solid rgba(255,255,255,0.1)"
                : "1px solid rgba(0,0,0,0.1)",
              boxShadow: isDark
                ? "0 20px 60px rgba(0,0,0,0.4)"
                : "0 20px 60px rgba(0,0,0,0.1)",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className="p-3 rounded-lg"
                style={{
                  background: isDark ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.1)",
                }}
              >
                <Lock size={20} color={isDark ? "#A78BFA" : "#8B5CF6"} />
              </div>
              <div>
                <h2
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "20px",
                    color: isDark ? "#E2E8F0" : "#1C1917",
                    letterSpacing: "0.05em",
                  }}
                >
                  ADMIN LOGIN
                </h2>
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "11px",
                    color: isDark ? "#71717A" : "#A8A29E",
                    marginTop: "2px",
                  }}
                >
                  Access restricted
                </p>
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-3 mb-6">
              <label
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: isDark ? "#E2E8F0" : "#1C1917",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Admin Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Enter admin password"
                  disabled={authenticating}
                  className="w-full px-4 py-3 rounded-lg font-mono text-sm transition-all"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                    border: passwordError
                      ? isDark
                        ? "1px solid rgba(239,68,68,0.5)"
                        : "1px solid rgba(239,68,68,0.3)"
                      : isDark
                      ? "1px solid rgba(255,255,255,0.1)"
                      : "1px solid rgba(0,0,0,0.1)",
                    color: isDark ? "#E2E8F0" : "#1C1917",
                  }}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-all hover:bg-white/10"
                  disabled={authenticating}
                >
                  {showPassword ? (
                    <EyeOff size={16} color={isDark ? "#A1A1AA" : "#78716C"} />
                  ) : (
                    <Eye size={16} color={isDark ? "#A1A1AA" : "#78716C"} />
                  )}
                </button>
              </div>

              {/* Error Message */}
              {passwordError && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "11px",
                    color: isDark ? "#EF4444" : "#DC2626",
                    marginTop: "6px",
                  }}
                >
                  {passwordError}
                </motion.p>
              )}
            </div>

            {/* Login Button */}
            <motion.button
              onClick={handleLogin}
              disabled={authenticating || !password.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: isDark ? "#8B5CF6" : "#7C3AED",
                color: "#FFFFFF",
              }}
            >
              {authenticating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock size={16} />
                  Unlock Admin Panel
                </>
              )}
            </motion.button>

            {/* Back Button */}
            <motion.button
              onClick={onBack}
              disabled={authenticating}
              className="w-full mt-3 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
              style={{
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                color: isDark ? "#E2E8F0" : "#1C1917",
                border: isDark
                  ? "1px solid rgba(255,255,255,0.1)"
                  : "1px solid rgba(0,0,0,0.1)",
              }}
            >
              Back
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

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

      {/* Header */}
      <div
        className="relative z-10 px-8 py-6 flex items-center justify-between"
        style={{
          borderBottom: isDark
            ? "1px solid rgba(255,255,255,0.05)"
            : "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          onClick={onBack}
          className="p-2 rounded-lg transition-all duration-200 hover:bg-white/5 active:bg-white/10"
          style={{
            color: isDark ? "#E2E8F0" : "#1C1917",
          }}
          title="Back"
        >
          <ArrowLeft size={20} />
        </motion.button>

        <div className="flex flex-col items-center gap-1">
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "24px",
              color: isDark ? "#E2E8F0" : "#1C1917",
              letterSpacing: "0.1em",
            }}
          >
            ADMIN PANEL
          </h1>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "10px",
              color: isDark ? "#71717A" : "#A8A29E",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            Request Management
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{
              background: isDark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.1)",
              color: isDark ? "#22C55E" : "#16A34A",
            }}
          >
            {pendingRequests.length} Pending
          </div>
          <motion.button
            onClick={() => {
              setAuthenticated(false);
              setPassword("");
              setRequests([]);
            }}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-white/5"
            style={{
              color: isDark ? "#A1A1AA" : "#78716C",
            }}
            title="Logout"
          >
            Logout
          </motion.button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto relative z-10 px-8 py-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <div className="space-y-3">
              <h2
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: isDark ? "#E2E8F0" : "#1C1917",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                🔵 Pending Requests ({pendingRequests.length})
              </h2>
              <div className="grid grid-cols-1 gap-3">
                <AnimatePresence>
                  {pendingRequests.map((req) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-lg p-4 flex items-center justify-between"
                      style={{
                        background: isDark ? "#141414" : "#FFFFFF",
                        border: isDark
                          ? "1px solid rgba(255,255,255,0.08)"
                          : "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      <div className="flex-1">
                        <p
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: isDark ? "#E2E8F0" : "#1C1917",
                          }}
                        >
                          {req.name}
                        </p>
                        <div
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: "11px",
                            color: isDark ? "#A1A1AA" : "#71717A",
                            marginTop: "4px",
                          }}
                        >
                          IP: {req.ip} • {new Date(req.timestamp).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(req.id, req.name)}
                          disabled={processingId === req.id}
                          className="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          style={{
                            background: isDark ? "#22C55E" : "#16A34A",
                            color: "#FFFFFF",
                          }}
                        >
                          {processingId === req.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle size={14} />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => handleWaitlist(req.id)}
                          disabled={processingId === req.id}
                          className="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          style={{
                            background: isDark ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.1)",
                            color: isDark ? "#FBBF24" : "#F59E0B",
                            border: isDark
                              ? "1px solid rgba(245,158,11,0.3)"
                              : "1px solid rgba(245,158,11,0.2)",
                          }}
                        >
                          {processingId === req.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Clock size={14} />
                          )}
                          Waitlist
                        </button>
                        <button
                          onClick={() => handleDeny(req.id)}
                          disabled={processingId === req.id}
                          className="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          style={{
                            background: isDark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.1)",
                            color: isDark ? "#EF4444" : "#DC2626",
                            border: isDark
                              ? "1px solid rgba(239,68,68,0.3)"
                              : "1px solid rgba(239,68,68,0.2)",
                          }}
                        >
                          {processingId === req.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <XCircle size={14} />
                          )}
                          Deny
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Approved Requests */}
          {approvedRequests.length > 0 && (
            <div className="space-y-3">
              <h2
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: isDark ? "#E2E8F0" : "#1C1917",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                ✅ Approved ({approvedRequests.length})
              </h2>
              <div className="grid grid-cols-1 gap-3">
                <AnimatePresence>
                  {approvedRequests.map((req) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-lg p-4"
                      style={{
                        background: isDark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.1)",
                        border: isDark
                          ? "1px solid rgba(34,197,94,0.2)"
                          : "1px solid rgba(34,197,94,0.15)",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p
                            style={{
                              fontFamily: "'Inter', sans-serif",
                              fontSize: "13px",
                              fontWeight: 600,
                              color: isDark ? "#22C55E" : "#16A34A",
                            }}
                          >
                            {req.name}
                          </p>
                          <div
                            style={{
                              fontFamily: "'Inter', sans-serif",
                              fontSize: "11px",
                              color: isDark ? "#A1A1AA" : "#71717A",
                              marginTop: "4px",
                            }}
                          >
                            IP: {req.ip} • {new Date(req.timestamp).toLocaleString()}
                          </div>
                        </div>

                        {req.token && (
                          <button
                            onClick={() => handleCopyToken(req.token!, req.id)}
                            className="px-3 py-2 rounded-lg font-mono text-xs transition-all duration-200 hover:shadow-lg flex items-center gap-2"
                            style={{
                              background: isDark ? "#141414" : "#FFFFFF",
                              border: isDark
                                ? "1px solid rgba(255,255,255,0.1)"
                                : "1px solid rgba(0,0,0,0.1)",
                              color: isDark ? "#E2E8F0" : "#1C1917",
                            }}
                          >
                            {copiedTokenId === req.id ? (
                              <>
                                <Check size={12} color={isDark ? "#22C55E" : "#16A34A"} />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                {req.token.slice(0, 8)}...
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Waitlisted Requests */}
          {waitlistedRequests.length > 0 && (
            <div className="space-y-3">
              <h2
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: isDark ? "#E2E8F0" : "#1C1917",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                ⏳ Waitlisted ({waitlistedRequests.length})
              </h2>
              <div className="grid grid-cols-1 gap-3">
                <AnimatePresence>
                  {waitlistedRequests.map((req) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-lg p-4"
                      style={{
                        background: isDark ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.05)",
                        border: isDark
                          ? "1px solid rgba(245,158,11,0.2)"
                          : "1px solid rgba(245,158,11,0.15)",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p
                            style={{
                              fontFamily: "'Inter', sans-serif",
                              fontSize: "13px",
                              fontWeight: 600,
                              color: isDark ? "#FBBF24" : "#F59E0B",
                            }}
                          >
                            {req.name}
                          </p>
                          <div
                            style={{
                              fontFamily: "'Inter', sans-serif",
                              fontSize: "11px",
                              color: isDark ? "#A1A1AA" : "#71717A",
                              marginTop: "4px",
                            }}
                          >
                            IP: {req.ip} • {new Date(req.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Denied Requests */}
          {deniedRequests.length > 0 && (
            <div className="space-y-3">
              <h2
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: isDark ? "#E2E8F0" : "#1C1917",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                ❌ Denied ({deniedRequests.length})
              </h2>
              <div className="grid grid-cols-1 gap-3">
                <AnimatePresence>
                  {deniedRequests.map((req) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-lg p-4"
                      style={{
                        background: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.05)",
                        border: isDark
                          ? "1px solid rgba(239,68,68,0.2)"
                          : "1px solid rgba(239,68,68,0.15)",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: isDark ? "#EF4444" : "#DC2626",
                          }}
                        >
                          {req.name}
                        </p>
                        <div
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: "11px",
                            color: isDark ? "#A1A1AA" : "#71717A",
                            marginTop: "4px",
                          }}
                        >
                          IP: {req.ip} • {new Date(req.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Empty State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 size={32} color={isDark ? "#E2E8F0" : "#1C1917"} />
              </motion.div>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "12px",
                  color: isDark ? "#A1A1AA" : "#71717A",
                  marginTop: "12px",
                }}
              >
                Loading requests...
              </p>
            </div>
          )}

          {!loading && requests.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "12px",
                  color: isDark ? "#A1A1AA" : "#71717A",
                }}
              >
                No requests yet
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
