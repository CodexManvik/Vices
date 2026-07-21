/**
 * TransactionLogPanel.tsx
 *
 * Audit trail and 1-click rollback interface for agentic tool execution.
 * Lists all filesystem and shell operations, renders unified diffs,
 * and allows administrators to execute immediate file/state rollbacks.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  History,
  RotateCcw,
  FileCode,
  Terminal,
  Globe,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Check,
} from "lucide-react";

export interface TransactionItem {
  id: string;
  timestamp: string;
  tool: string;
  target: string;
  operation: string; // "write" | "delete" | "exec" | "rollback"
  diff: string;
  status: "completed" | "rolled_back";
}

interface TransactionLogPanelProps {
  isDark: boolean;
  sessionUrl: string | null;
  adminPassword: string;
}

export function TransactionLogPanel({ isDark, sessionUrl, adminPassword }: TransactionLogPanelProps) {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  // Design Tokens
  const cardBg = isDark ? "rgba(20, 20, 20, 0.85)" : "rgba(255, 255, 255, 0.9)";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const textPrimary = isDark ? "#F4F4F5" : "#18181B";
  const textMuted = isDark ? "#A1A1AA" : "#71717A";
  const codeBg = isDark ? "#09090B" : "#F4F4F5";

  const fetchTransactions = useCallback(async () => {
    if (!sessionUrl) return;
    setLoading(true);
    setError(null);
    try {
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/admin/transactions?limit=100`, {
        method: "GET",
        headers: {
          password: adminPassword,
          "ngrok-skip-browser-warning": "bypass",
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load transaction audit log (HTTP ${res.status})`);
      }

      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err: any) {
      setError(err?.message || "Error fetching transaction logs.");
    } finally {
      setLoading(false);
    }
  }, [sessionUrl, adminPassword]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleRollback = async (txnId: string) => {
    if (!sessionUrl) return;
    if (!confirm(`Are you sure you want to rollback transaction '${txnId}'?`)) return;

    setRollingBackId(txnId);
    try {
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/admin/transactions/${txnId}/rollback`, {
        method: "POST",
        headers: {
          password: adminPassword,
        },
      });

      const data = await res.json();
      if (res.ok) {
        await fetchTransactions();
      } else {
        alert(`Rollback failed: ${data.detail || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Rollback error: ${err.message}`);
    } finally {
      setActionLoadingIdNull();
    }
  };

  const setActionLoadingIdNull = () => setRollingBackId(null);

  const getToolIcon = (tool: string) => {
    if (tool.includes("shell")) return <Terminal size={14} className="text-amber-400" />;
    if (tool.includes("browser")) return <Globe size={14} className="text-sky-400" />;
    if (tool.includes("delete")) return <Trash2 size={14} className="text-red-400" />;
    return <FileText size={14} className="text-purple-400" />;
  };

  return (
    <div className="w-full flex flex-col gap-6 p-6 max-w-6xl mx-auto font-sans">
      {/* Header Banner */}
      <div
        className="rounded-2xl p-6 backdrop-blur-md border flex items-center justify-between gap-4"
        style={{ background: cardBg, borderColor: cardBorder }}
      >
        <div className="flex items-center gap-4">
          <div
            className="p-3.5 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: isDark ? "rgba(56,189,248,0.15)" : "rgba(2,132,199,0.1)",
              border: `1px solid ${isDark ? "rgba(56,189,248,0.3)" : "rgba(2,132,199,0.2)"}`,
            }}
          >
            <History size={24} color={isDark ? "#38BDF8" : "#0284C7"} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: textPrimary }}>
                Agentic Transaction Audit Log
              </h2>
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider"
                style={{
                  background: isDark ? "rgba(34,197,94,0.15)" : "rgba(22,163,74,0.12)",
                  color: isDark ? "#4ADE80" : "#16A34A",
                  border: `1px solid ${isDark ? "rgba(34,197,94,0.25)" : "rgba(22,163,74,0.25)"}`,
                }}
              >
                1-Click Rollback Active
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: textMuted }}>
              Immutable log of every file write, deletion, and shell command executed by the AI agent.
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchTransactions()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer"
          style={{ background: "rgba(255,255,255,0.05)", color: textPrimary, border: `1px solid ${cardBorder}` }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh History</span>
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl border flex items-center gap-3 text-xs bg-red-500/10 border-red-500/30 text-red-400">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Transaction List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={24} className="animate-spin text-sky-400" />
          <span className="text-xs" style={{ color: textMuted }}>
            Loading transaction audit records...
          </span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border" style={{ background: cardBg, borderColor: cardBorder }}>
          <History size={36} className="mb-3 opacity-40" style={{ color: textMuted }} />
          <h4 className="text-sm font-semibold" style={{ color: textPrimary }}>
            No Transactions Logged Yet
          </h4>
          <p className="text-xs max-w-md mt-1" style={{ color: textMuted }}>
            As the AI agent performs file edits, list operations, or shell executions, all actions will be diffed and recorded here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {transactions.map((txn) => {
              const isExpanded = expandedId === txn.id;
              const isRolledBack = txn.status === "rolled_back";
              const isRolling = rollingBackId === txn.id;

              return (
                <motion.div
                  key={txn.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="rounded-2xl border flex flex-col overflow-hidden transition-all"
                  style={{
                    background: cardBg,
                    borderColor: isRolledBack ? "rgba(113,113,122,0.25)" : cardBorder,
                    opacity: isRolledBack ? 0.75 : 1,
                  }}
                >
                  {/* Item Summary Bar */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : txn.id)}
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                        {getToolIcon(txn.tool)}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold" style={{ color: textPrimary }}>
                            {txn.tool}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
                            style={{
                              background:
                                txn.operation === "write"
                                  ? "rgba(56,189,248,0.15)"
                                  : txn.operation === "delete"
                                  ? "rgba(239,68,68,0.15)"
                                  : "rgba(245,158,11,0.15)",
                              color:
                                txn.operation === "write"
                                  ? "#38BDF8"
                                  : txn.operation === "delete"
                                  ? "#EF4444"
                                  : "#F59E0B",
                            }}
                          >
                            {txn.operation}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono truncate max-w-md" style={{ color: textMuted }}>
                          {txn.target}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-[11px] font-mono flex items-center gap-1" style={{ color: textMuted }}>
                        <Clock size={12} />
                        {new Date(txn.timestamp).toLocaleTimeString()}
                      </span>

                      {isRolledBack ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">
                          Rolled Back
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRollback(txn.id);
                          }}
                          disabled={isRolling}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer"
                        >
                          {isRolling ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                          <span>Rollback</span>
                        </button>
                      )}

                      {isExpanded ? <ChevronUp size={16} style={{ color: textMuted }} /> : <ChevronDown size={16} style={{ color: textMuted }} />}
                    </div>
                  </div>

                  {/* Expanded Details / Diff Viewer */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t flex flex-col gap-3" style={{ borderColor: cardBorder }}>
                      <div className="flex items-center justify-between text-xs" style={{ color: textMuted }}>
                        <span className="font-mono text-[11px]">Transaction ID: {txn.id}</span>
                        <span className="font-mono text-[11px]">{new Date(txn.timestamp).toLocaleString()}</span>
                      </div>

                      {txn.diff ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                            Unified Execution Diff / Output
                          </span>
                          <pre
                            className="p-3.5 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed border"
                            style={{ background: codeBg, borderColor: cardBorder, color: textPrimary }}
                          >
                            {txn.diff}
                          </pre>
                        </div>
                      ) : (
                        <span className="text-xs italic" style={{ color: textMuted }}>
                          No structural diff recorded for this operation.
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
