import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Database,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Tag,
  Share2,
  Cpu
} from "lucide-react";

interface MemoryBrowserProps {
  isDark: boolean;
  sessionUrl: string | null;
  onClose: () => void;
}

const T = {
  bg: (dark: boolean) => (dark ? "rgba(10, 10, 10, 0.85)" : "rgba(245, 245, 244, 0.85)"),
  card: (dark: boolean) => (dark ? "#0E0E0E" : "#FFFFFF"),
  cardBorder: (dark: boolean) =>
    dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)",
  text: (dark: boolean) => (dark ? "#E2E8F0" : "#1C1917"),
  muted: (dark: boolean) => (dark ? "#71717A" : "#8E8781"),
  dim: (dark: boolean) => (dark ? "#52525B" : "#A8A29E"),
  separator: (dark: boolean) =>
    dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
  accent: "#38BDF8",
  accentDim: "rgba(56,189,248,0.12)",
  accentBorder: "rgba(56,189,248,0.2)",
};

export function MemoryBrowser({ isDark, sessionUrl, onClose }: MemoryBrowserProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState(localStorage.getItem("vices_admin_password") || "");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);

  // Data states
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [vectors, setVectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"vectors" | "graph">("vectors");
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchUrl = (sessionUrl || "http://localhost:8000").replace(/\/+$/, "");

  const loadMemories = async (adminPassword = password) => {
    setLoading(true);
    setPasswordError("");
    try {
      const res = await fetch(`${fetchUrl}/admin/memories`, {
        method: "GET",
        headers: {
          "password": adminPassword,
        },
      });

      if (res.status === 401) {
        setAuthenticated(false);
        setPasswordError("Invalid password. Access denied.");
        return;
      }

      if (!res.ok) {
        throw new Error("Server error fetching diagnostics");
      }

      const data = await res.json();
      setGraphData(data.graph || { nodes: [], links: [] });
      setVectors(data.vectors || []);
      setAuthenticated(true);
      localStorage.setItem("vices_admin_password", adminPassword);
    } catch (e: any) {
      setPasswordError(e?.message || "Failed to load diagnostic database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (password) {
      loadMemories(password);
    }
  }, [sessionUrl]);

  const handleLogin = () => {
    if (!password.trim()) {
      setPasswordError("Password is required");
      return;
    }
    loadMemories(password);
  };

  const handlePruneGraphNode = async (nodeName: string) => {
    setActioningId(nodeName);
    try {
      const res = await fetch(`${fetchUrl}/admin/memories/graph/${encodeURIComponent(nodeName)}`, {
        method: "DELETE",
        headers: {
          "password": password,
        },
      });
      if (res.ok) {
        setGraphData(prev => ({
          nodes: prev.nodes.filter(n => n.id !== nodeName),
          links: prev.links.filter(l => l.source !== nodeName && l.target !== nodeName)
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActioningId(null);
    }
  };

  const handlePruneVectorMemory = async (id: string) => {
    setActioningId(id);
    try {
      const res = await fetch(`${fetchUrl}/admin/memories/vector/${id}`, {
        method: "DELETE",
        headers: {
          "password": password,
        },
      });
      if (res.ok) {
        setVectors(prev => prev.filter(v => v.id !== id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-3xl h-[80vh] flex flex-col rounded-2xl relative overflow-hidden"
        style={{
          background: isDark ? "#0A0A0A" : "#FAFAF9",
          border: `1px solid ${T.cardBorder(isDark)}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${T.separator(isDark)}` }}
        >
          <div className="flex items-center gap-2.5">
            <Database size={18} style={{ color: T.accent }} />
            <div>
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "20px",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  color: T.text(isDark),
                }}
              >
                Memory Diagnostic Console
              </h2>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "11px",
                  color: T.muted(isDark),
                }}
              >
                Inspect and prune persistent vector database layers &amp; relational entity graphs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: T.dim(isDark) }}
            className="p-1 rounded-md transition-colors hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Auth phase */}
        {!authenticated ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 max-w-sm mx-auto w-full gap-5">
            <div className="flex flex-col items-center gap-2 mb-2">
              <div
                className="p-3 rounded-lg"
                style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
              >
                <Lock size={20} style={{ color: T.accent }} />
              </div>
              <span className="font-semibold text-sm" style={{ color: T.text(isDark) }}>
                Admin Authentication Required
              </span>
            </div>
            <div className="w-full relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter admin password"
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg font-mono text-xs"
                style={{
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                  border: `1px solid ${passwordError ? "#EF4444" : T.cardBorder(isDark)}`,
                  color: T.text(isDark),
                }}
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10"
              >
                {showPassword ? (
                  <EyeOff size={14} style={{ color: T.muted(isDark) }} />
                ) : (
                  <Eye size={14} style={{ color: T.muted(isDark) }} />
                )}
              </button>
            </div>
            {passwordError && (
              <p className="text-xs text-red-500 text-center">{passwordError}</p>
            )}
            <button
              onClick={handleLogin}
              disabled={loading || !password.trim()}
              className="w-full py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all flex items-center justify-center gap-2"
              style={{
                background: T.accent,
                color: "#000",
              }}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : "Authenticate"}
            </button>
          </div>
        ) : (
          /* Main console display */
          <>
            {/* Tab layout */}
            <div
              className="flex border-b"
              style={{
                borderColor: T.separator(isDark),
                background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
              }}
            >
              <button
                onClick={() => setActiveTab("vectors")}
                className="flex-1 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all"
                style={{
                  color: activeTab === "vectors" ? T.accent : T.dim(isDark),
                  borderBottomColor: activeTab === "vectors" ? T.accent : "transparent",
                }}
              >
                Vector Semantic Database ({vectors.length})
              </button>
              <button
                onClick={() => setActiveTab("graph")}
                className="flex-1 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all"
                style={{
                  color: activeTab === "graph" ? T.accent : T.dim(isDark),
                  borderBottomColor: activeTab === "graph" ? T.accent : "transparent",
                }}
              >
                Relational Graph Nodes ({graphData.nodes.length})
              </button>
            </div>

            {/* List panel */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin" style={{ color: T.accent }} />
                </div>
              ) : activeTab === "vectors" ? (
                /* Vector items */
                vectors.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                    <p style={{ color: T.dim(isDark), fontSize: "13px" }}>No vector memories present.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {vectors.map((vec) => (
                      <div
                        key={vec.id}
                        className="p-4 rounded-xl flex items-start justify-between gap-4 transition-colors"
                        style={{
                          background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.025)",
                          border: `1px solid ${T.cardBorder(isDark)}`,
                        }}
                      >
                        <div className="flex flex-col gap-2.5">
                          <p style={{ fontSize: "12.5px", color: T.text(isDark), lineHeight: 1.5 }}>
                            "{vec.text}"
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {vec.tags.map((tag: string) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                                style={{
                                  background: isDark ? "rgba(56,189,248,0.1)" : "rgba(56,189,248,0.08)",
                                  color: T.accent,
                                }}
                              >
                                <Tag size={8} />
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => handlePruneVectorMemory(vec.id)}
                          disabled={actioningId === vec.id}
                          className="p-1.5 rounded hover:bg-red-500/10 text-red-500/70 hover:text-red-500 transition-colors shrink-0"
                          title="Prune Memory"
                        >
                          {actioningId === vec.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* Graph nodes items */
                graphData.nodes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                    <p style={{ color: T.dim(isDark), fontSize: "13px" }}>No relational graph entities mapped.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {graphData.nodes.map((node) => {
                      const connections = graphData.links.filter(
                        l => l.source === node.id || l.target === node.id
                      );
                      const isCore = node.type === "core";

                      return (
                        <div
                          key={node.id}
                          className="p-4 rounded-xl flex items-center justify-between transition-colors"
                          style={{
                            background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.025)",
                            border: `1px solid ${T.cardBorder(isDark)}`,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="p-2 rounded-lg"
                              style={{
                                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                                border: `1px solid ${T.cardBorder(isDark)}`,
                              }}
                            >
                              {isCore ? (
                                <Cpu size={14} style={{ color: T.accent }} />
                              ) : (
                                <Share2 size={14} style={{ color: T.muted(isDark) }} />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold" style={{ color: T.text(isDark) }}>
                                {node.id}
                              </p>
                              <p style={{ fontSize: "10px", color: T.dim(isDark), marginTop: "1px" }}>
                                {isCore ? "Ego Node" : `${connections.length} Relation links`}
                              </p>
                            </div>
                          </div>

                          {!isCore && (
                            <button
                              onClick={() => handlePruneGraphNode(node.id)}
                              disabled={actioningId === node.id}
                              className="p-1.5 rounded hover:bg-red-500/10 text-red-500/70 hover:text-red-500 transition-colors shrink-0"
                              title="Delete Entity"
                            >
                              {actioningId === node.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Trash2 size={13} />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div
              className="px-6 py-3 flex items-center justify-between"
              style={{
                borderTop: `1px solid ${T.separator(isDark)}`,
                background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
              }}
            >
              <div className="flex items-center gap-1.5 text-red-500/70">
                <AlertTriangle size={13} />
                <span style={{ fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>
                  Actioning deletions here commits changes immediately to persistent database sectors.
                </span>
              </div>
              <button
                onClick={() => loadMemories()}
                className="text-[11px] hover:underline"
                style={{ color: T.muted(isDark) }}
              >
                Reload Data
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
