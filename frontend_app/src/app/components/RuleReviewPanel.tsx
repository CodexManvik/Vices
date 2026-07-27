/**
 * RuleReviewPanel.tsx
 *
 * Human-in-the-Loop Review Interface for Reflective Skill Memory (RSM).
 * Displays quarantined behavioral rules generated during meta-cognitive consolidation passes,
 * allowing admins to review, edit, approve, reject, or deprecate directives.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Edit3,
  Archive,
  RefreshCw,
  Loader2,
  Sparkles,
  AlertCircle,
  BrainCircuit,
  Filter,
  Check,
  X,
  ChevronRight,
  Info,
} from "lucide-react";

export interface BehavioralRule {
  id: string;
  scope: string; // "global" | "session"
  target_context: string;
  body: string; // The directive text
  rationale: string;
  confidence: number;
  status: "quarantined" | "approved" | "deprecated";
  created_at: string;
}

interface RuleReviewPanelProps {
  isDark: boolean;
  sessionUrl: string | null;
  adminPassword: string;
}

export function RuleReviewPanel({ isDark, sessionUrl, adminPassword }: RuleReviewPanelProps) {
  const [rules, setRules] = useState<BehavioralRule[]>([]);
  const [counts, setCounts] = useState<{ quarantined: number; approved: number; deprecated: number }>({
    quarantined: 0,
    approved: 0,
    deprecated: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"quarantined" | "approved" | "deprecated" | "all">("quarantined");

  // Action state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Edit Modal State
  const [editingRule, setEditingRule] = useState<BehavioralRule | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editRationale, setEditRationale] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Styling Tokens
  const cardBg = isDark ? "rgba(20, 20, 20, 0.8)" : "rgba(255, 255, 255, 0.9)";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const textPrimary = isDark ? "#F4F4F5" : "#18181B";
  const textMuted = isDark ? "#A1A1AA" : "#71717A";
  const inputBg = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";

  // Fetch rules from backend
  const fetchRules = useCallback(async () => {
    if (!sessionUrl) return;
    setLoading(true);
    setError(null);
    try {
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const queryParam = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const res = await fetch(`${baseUrl}/admin/rules${queryParam}`, {
        method: "GET",
        headers: {
          password: adminPassword,
          "ngrok-skip-browser-warning": "bypass",
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load rules (HTTP ${res.status})`);
      }

      const data = await res.json();
      setRules(data.rules || []);
      if (data.count) {
        setCounts(data.count);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load behavioral rules.");
    } finally {
      setLoading(false);
    }
  }, [sessionUrl, adminPassword, statusFilter]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Subscribe to SSE rule quarantine stream for real-time updates
  useEffect(() => {
    if (!sessionUrl) return;
    const baseUrl = sessionUrl.replace(/\/+$/, "");
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`${baseUrl}/admin/rules/notifications/stream`);
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "rules_quarantined") {
            fetchRules();
          }
        } catch {
          // Ignore parse errors
        }
      };
    } catch (e) {
      console.warn("Rule notification stream unavailable:", e);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [sessionUrl, fetchRules]);

  // Handle Approve
  const handleApprove = async (ruleId: string) => {
    if (!sessionUrl) return;
    setActionLoadingId(ruleId);
    try {
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/admin/rules/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          password: adminPassword,
        },
        body: JSON.stringify({ rule_id: ruleId }),
      });

      if (res.ok) {
        await fetchRules();
      } else {
        const err = await res.json();
        alert(`Approve failed: ${err.detail || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Approve error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Reject
  const handleReject = async (ruleId: string) => {
    if (!sessionUrl) return;
    setActionLoadingId(ruleId);
    try {
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/admin/rules/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          password: adminPassword,
        },
        body: JSON.stringify({ rule_id: ruleId }),
      });

      if (res.ok) {
        await fetchRules();
      } else {
        const err = await res.json();
        alert(`Reject failed: ${err.detail || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Reject error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Deprecate
  const handleDeprecate = async (ruleId: string) => {
    if (!sessionUrl) return;
    if (!confirm("Are you sure you want to deprecate this rule? It will be deactivated immediately.")) return;
    setActionLoadingId(ruleId);
    try {
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/admin/rules/${ruleId}`, {
        method: "DELETE",
        headers: {
          password: adminPassword,
        },
      });

      if (res.ok) {
        await fetchRules();
      } else {
        const err = await res.json();
        alert(`Deprecate failed: ${err.detail || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Deprecate error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Edit Modal
  const openEditModal = (rule: BehavioralRule) => {
    setEditingRule(rule);
    setEditBody(rule.body);
    setEditRationale(rule.rationale);
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!sessionUrl || !editingRule) return;
    setEditSubmitting(true);
    try {
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/admin/rules/edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          password: adminPassword,
        },
        body: JSON.stringify({
          rule_id: editingRule.id,
          body: editBody,
          rationale: editRationale,
        }),
      });

      if (res.ok) {
        setEditingRule(null);
        await fetchRules();
      } else {
        const err = await res.json();
        alert(`Edit failed: ${err.detail || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Edit error: ${err.message}`);
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 p-6 max-w-6xl mx-auto font-sans">
      {/* Overview & Header Banner */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden backdrop-blur-md border"
        style={{ background: cardBg, borderColor: cardBorder }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div
              className="p-3.5 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: isDark ? "rgba(139,92,246,0.15)" : "rgba(124,58,237,0.1)",
                border: `1px solid ${isDark ? "rgba(139,92,246,0.3)" : "rgba(124,58,237,0.2)"}`,
              }}
            >
              <BrainCircuit size={24} color={isDark ? "#A78BFA" : "#7C3AED"} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight" style={{ color: textPrimary }}>
                  RSM Rule Engine
                </h2>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider"
                  style={{
                    background: isDark ? "rgba(56,189,248,0.12)" : "rgba(14,165,233,0.12)",
                    color: isDark ? "#38BDF8" : "#0284C7",
                    border: `1px solid ${isDark ? "rgba(56,189,248,0.25)" : "rgba(14,165,233,0.25)"}`,
                  }}
                >
                  Meta-Cognitive RLHF
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: textMuted }}>
                Document-Grounded Behavioral Directives distilled from conversation reflection passes.
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchRules()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all self-start md:self-auto cursor-pointer"
            style={{
              background: inputBg,
              color: textPrimary,
              border: `1px solid ${cardBorder}`,
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh Rules</span>
          </button>
        </div>

        {/* Counter Badge Cards */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t" style={{ borderColor: cardBorder }}>
          <div
            onClick={() => setStatusFilter("quarantined")}
            className="p-4 rounded-xl cursor-pointer transition-all border flex items-center justify-between"
            style={{
              background: statusFilter === "quarantined" ? (isDark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.08)") : inputBg,
              borderColor: statusFilter === "quarantined" ? "#F59E0B" : cardBorder,
            }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: isDark ? "#FBBF24" : "#D97706" }}>
                Quarantined (Review Needed)
              </span>
              <span className="text-2xl font-bold font-mono" style={{ color: textPrimary }}>
                {counts.quarantined}
              </span>
            </div>
            <ShieldAlert size={22} color="#F59E0B" />
          </div>

          <div
            onClick={() => setStatusFilter("approved")}
            className="p-4 rounded-xl cursor-pointer transition-all border flex items-center justify-between"
            style={{
              background: statusFilter === "approved" ? (isDark ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.08)") : inputBg,
              borderColor: statusFilter === "approved" ? "#22C55E" : cardBorder,
            }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: isDark ? "#4ADE80" : "#16A34A" }}>
                Active Directives
              </span>
              <span className="text-2xl font-bold font-mono" style={{ color: textPrimary }}>
                {counts.approved}
              </span>
            </div>
            <CheckCircle2 size={22} color="#22C55E" />
          </div>

          <div
            onClick={() => setStatusFilter("deprecated")}
            className="p-4 rounded-xl cursor-pointer transition-all border flex items-center justify-between"
            style={{
              background: statusFilter === "deprecated" ? (isDark ? "rgba(113,113,122,0.15)" : "rgba(113,113,122,0.1)") : inputBg,
              borderColor: statusFilter === "deprecated" ? "#71717A" : cardBorder,
            }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: textMuted }}>
                Deprecated Rules
              </span>
              <span className="text-2xl font-bold font-mono" style={{ color: textPrimary }}>
                {counts.deprecated}
              </span>
            </div>
            <Archive size={22} color="#71717A" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: cardBorder }}>
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: textMuted }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
            Filter View:
          </span>
          {(["quarantined", "approved", "deprecated", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer"
              style={{
                background: statusFilter === tab ? (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)") : "transparent",
                color: statusFilter === tab ? textPrimary : textMuted,
              }}
            >
              {tab === "all" ? "All Directives" : tab}
            </button>
          ))}
        </div>

        <span className="text-xs font-mono" style={{ color: textMuted }}>
          Showing {rules.length} rule{rules.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="p-4 rounded-xl border flex items-center gap-3 text-xs"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            borderColor: "rgba(239, 68, 68, 0.3)",
            color: "#EF4444",
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Rules Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={24} className="animate-spin text-purple-500" />
          <span className="text-xs" style={{ color: textMuted }}>
            Retrieving directives from LanceDB...
          </span>
        </div>
      ) : rules.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border"
          style={{ background: cardBg, borderColor: cardBorder }}
        >
          <BrainCircuit size={36} className="mb-3 opacity-40" style={{ color: textMuted }} />
          <h4 className="text-sm font-semibold" style={{ color: textPrimary }}>
            No {statusFilter === "all" ? "" : statusFilter} directives found
          </h4>
          <p className="text-xs max-w-md mt-1" style={{ color: textMuted }}>
            {statusFilter === "quarantined"
              ? "All pending rules have been reviewed. As you chat, the system periodically runs meta-cognitive reflection to extract new behavioral rules."
              : "No rules match the selected status filter."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <AnimatePresence>
            {rules.map((rule) => {
              const isQuarantined = rule.status === "quarantined";
              const isApproved = rule.status === "approved";
              const isActioning = actionLoadingId === rule.id;

              return (
                <motion.div
                  key={rule.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="rounded-2xl p-5 border flex flex-col gap-4 relative overflow-hidden"
                  style={{
                    background: cardBg,
                    borderColor: isQuarantined
                      ? "rgba(245,158,11,0.3)"
                      : isApproved
                      ? "rgba(34,197,94,0.25)"
                      : cardBorder,
                  }}
                >
                  {/* Status & ID Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5"
                        style={{
                          background: isQuarantined
                            ? "rgba(245,158,11,0.15)"
                            : isApproved
                            ? "rgba(34,197,94,0.15)"
                            : "rgba(113,113,122,0.15)",
                          color: isQuarantined
                            ? "#F59E0B"
                            : isApproved
                            ? "#22C55E"
                            : "#71717A",
                          border: `1px solid ${
                            isQuarantined
                              ? "rgba(245,158,11,0.3)"
                              : isApproved
                              ? "rgba(34,197,94,0.3)"
                              : "rgba(113,113,122,0.3)"
                          }`,
                        }}
                      >
                        {isQuarantined ? <ShieldAlert size={12} /> : isApproved ? <CheckCircle2 size={12} /> : <Archive size={12} />}
                        {rule.status}
                      </span>

                      <span className="text-[11px] font-mono" style={{ color: textMuted }}>
                        ID: {rule.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs" style={{ color: textMuted }}>
                      <span className="px-2 py-0.5 rounded bg-black/20 font-mono text-[10px]">
                        Scope: {rule.scope}
                      </span>
                      <span>
                        Confidence: <strong className="font-mono text-purple-400">{Math.round(rule.confidence * 100)}%</strong>
                      </span>
                      <span className="text-[11px]">
                        {new Date(rule.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Target Context */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400">
                      Target Context / Scenario Trigger
                    </span>
                    <p className="text-xs font-mono p-2.5 rounded-lg border" style={{ background: inputBg, borderColor: cardBorder, color: textPrimary }}>
                      {rule.target_context}
                    </p>
                  </div>

                  {/* Directive Body */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                      Behavioral Directive Instructions
                    </span>
                    <div className="p-3.5 rounded-xl border font-mono text-xs whitespace-pre-wrap leading-relaxed" style={{ background: isDark ? "#09090B" : "#F4F4F5", borderColor: cardBorder, color: textPrimary }}>
                      {rule.body}
                    </div>
                  </div>

                  {/* Rationale */}
                  <div className="flex items-start gap-2 text-xs p-2.5 rounded-lg" style={{ background: "rgba(139,92,246,0.06)", color: textMuted }}>
                    <Info size={14} className="shrink-0 mt-0.5 text-purple-400" />
                    <div>
                      <strong className="text-purple-400 font-medium">Reflection Rationale: </strong>
                      {rule.rationale}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-2 border-t" style={{ borderColor: cardBorder }}>
                    {isQuarantined && (
                      <>
                        <button
                          onClick={() => handleReject(rule.id)}
                          disabled={isActioning}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:bg-red-500/10 cursor-pointer"
                          style={{ color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}
                        >
                          <XCircle size={14} />
                          <span>Reject</span>
                        </button>

                        <button
                          onClick={() => openEditModal(rule)}
                          disabled={isActioning}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:bg-purple-500/10 cursor-pointer"
                          style={{ color: "#A78BFA", border: "1px solid rgba(167,139,250,0.3)" }}
                        >
                          <Edit3 size={14} />
                          <span>Edit Rule</span>
                        </button>

                        <button
                          onClick={() => handleApprove(rule.id)}
                          disabled={isActioning}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all hover:opacity-90 cursor-pointer"
                          style={{ background: "#22C55E", color: "#000" }}
                        >
                          {isActioning ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          <span>Approve & Activate</span>
                        </button>
                      </>
                    )}

                    {isApproved && (
                      <button
                        onClick={() => handleDeprecate(rule.id)}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:bg-amber-500/10 cursor-pointer"
                        style={{ color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}
                      >
                        {isActioning ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                        <span>Deprecate Directive</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Edit Rule Modal */}
      <AnimatePresence>
        {editingRule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl rounded-2xl p-6 border shadow-2xl flex flex-col gap-4"
              style={{ background: isDark ? "#121214" : "#FFFFFF", borderColor: cardBorder }}
            >
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: cardBorder }}>
                <div className="flex items-center gap-2">
                  <Edit3 size={18} className="text-purple-400" />
                  <h3 className="text-base font-semibold" style={{ color: textPrimary }}>
                    Edit Behavioral Directive ({editingRule.id})
                  </h3>
                </div>
                <button onClick={() => setEditingRule(null)} className="p-1 rounded-lg hover:bg-white/10" style={{ color: textMuted }}>
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                  Behavioral Directive (Yaml / Prompt Block)
                </label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={6}
                  className="w-full p-3 rounded-xl font-mono text-xs leading-relaxed outline-none border focus:border-purple-500"
                  style={{ background: inputBg, borderColor: cardBorder, color: textPrimary }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                  Rationale / Context
                </label>
                <input
                  type="text"
                  value={editRationale}
                  onChange={(e) => setEditRationale(e.target.value)}
                  className="w-full p-3 rounded-xl text-xs outline-none border focus:border-purple-500"
                  style={{ background: inputBg, borderColor: cardBorder, color: textPrimary }}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: cardBorder }}>
                <button
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium"
                  style={{ color: textMuted, border: `1px solid ${cardBorder}` }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-black shadow-md cursor-pointer"
                  style={{ background: "#A78BFA" }}
                >
                  {editSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Save Changes</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
