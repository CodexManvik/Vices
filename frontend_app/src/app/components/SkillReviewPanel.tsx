/**
 * SkillReviewPanel.tsx
 *
 * Human-in-the-Loop review interface for RSM learned skills.
 * Skills are procedural playbooks the agent writes after completing
 * tool-using tasks. They live as markdown files on disk
 * (~/.aethel/knowledge/skills/) and flow quarantined -> approved -> deprecated,
 * with outcome statistics (retrievals / successes / failures) driving
 * reward-weighted retrieval and auto-deprecation.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Archive,
  RefreshCw,
  Loader2,
  AlertCircle,
  Wrench,
  Filter,
  TrendingUp,
  TrendingDown,
  Repeat,
  FileText,
} from "lucide-react";

export interface LearnedSkill {
  id: string;
  type: string;
  title?: string;
  category: string;
  scope: string;
  status: "quarantined" | "approved" | "deprecated";
  confidence: number;
  created_at: string;
  times_retrieved: number;
  times_succeeded: number;
  times_failed: number;
  body: string;
}

interface SkillReviewPanelProps {
  isDark: boolean;
  sessionUrl: string | null;
  adminPassword: string;
}

export function SkillReviewPanel({ isDark, sessionUrl, adminPassword }: SkillReviewPanelProps) {
  const [skills, setSkills] = useState<LearnedSkill[]>([]);
  const [counts, setCounts] = useState<{ quarantined: number; approved: number; deprecated: number }>({
    quarantined: 0,
    approved: 0,
    deprecated: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"quarantined" | "approved" | "deprecated" | "all">("quarantined");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const cardBg = isDark ? "rgba(20, 20, 20, 0.8)" : "rgba(255, 255, 255, 0.9)";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const textPrimary = isDark ? "#F4F4F5" : "#18181B";
  const textMuted = isDark ? "#A1A1AA" : "#71717A";
  const inputBg = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";

  const fetchSkills = useCallback(async () => {
    if (!sessionUrl) return;
    setLoading(true);
    setError(null);
    try {
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const queryParam = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const res = await fetch(`${baseUrl}/admin/skills${queryParam}`, {
        method: "GET",
        headers: {
          password: adminPassword,
          "ngrok-skip-browser-warning": "bypass",
        },
      });
      if (!res.ok) throw new Error(`Failed to load skills (HTTP ${res.status})`);
      const data = await res.json();
      setSkills(data.skills || []);
      if (data.count) setCounts(data.count);
    } catch (err: any) {
      setError(err?.message || "Failed to load learned skills.");
    } finally {
      setLoading(false);
    }
  }, [sessionUrl, adminPassword, statusFilter]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Real-time refresh when the backend quarantines a new skill.
  useEffect(() => {
    if (!sessionUrl) return;
    const baseUrl = sessionUrl.replace(/\/+$/, "");
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${baseUrl}/admin/rules/notifications/stream`);
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "skill_quarantined") fetchSkills();
        } catch {
          // ignore parse errors
        }
      };
    } catch (e) {
      console.warn("Skill notification stream unavailable:", e);
    }
    return () => {
      if (eventSource) eventSource.close();
    };
  }, [sessionUrl, fetchSkills]);

  const postAction = async (endpoint: string, skillId: string) => {
    if (!sessionUrl) return;
    setActionLoadingId(skillId);
    try {
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/admin/skills/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          password: adminPassword,
        },
        body: JSON.stringify({ skill_id: skillId }),
      });
      if (res.ok) {
        await fetchSkills();
      } else {
        const err = await res.json();
        alert(`Action failed: ${err.detail || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const successRate = (s: LearnedSkill): string => {
    const total = s.times_succeeded + s.times_failed;
    if (!total) return "—";
    return `${Math.round((s.times_succeeded / total) * 100)}%`;
  };

  return (
    <div className="w-full flex flex-col gap-6 p-6 max-w-6xl mx-auto font-sans">
      {/* Header */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden backdrop-blur-md border"
        style={{ background: cardBg, borderColor: cardBorder }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div
              className="p-3.5 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: isDark ? "rgba(56,189,248,0.15)" : "rgba(14,165,233,0.1)",
                border: `1px solid ${isDark ? "rgba(56,189,248,0.3)" : "rgba(14,165,233,0.2)"}`,
              }}
            >
              <Wrench size={24} color={isDark ? "#38BDF8" : "#0284C7"} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight" style={{ color: textPrimary }}>
                  RSM Skill Library
                </h2>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider"
                  style={{
                    background: isDark ? "rgba(139,92,246,0.12)" : "rgba(124,58,237,0.12)",
                    color: isDark ? "#A78BFA" : "#7C3AED",
                    border: `1px solid ${isDark ? "rgba(139,92,246,0.25)" : "rgba(124,58,237,0.25)"}`,
                  }}
                >
                  Markdown on Disk
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: textMuted }}>
                Procedural playbooks the agent wrote after completing tasks. Approved skills are injected into future
                similar tasks; their success rate curates the library automatically.
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchSkills()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all self-start md:self-auto cursor-pointer"
            style={{ background: inputBg, color: textPrimary, border: `1px solid ${cardBorder}` }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh Skills</span>
          </button>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t" style={{ borderColor: cardBorder }}>
          {(
            [
              { key: "quarantined", label: "Quarantined (Review Needed)", color: "#F59E0B", icon: ShieldAlert },
              { key: "approved", label: "Active Skills", color: "#22C55E", icon: CheckCircle2 },
              { key: "deprecated", label: "Deprecated Skills", color: "#71717A", icon: Archive },
            ] as const
          ).map(({ key, label, color, icon: Icon }) => (
            <div
              key={key}
              onClick={() => setStatusFilter(key)}
              className="p-4 rounded-xl cursor-pointer transition-all border flex items-center justify-between"
              style={{
                background: statusFilter === key ? `${color}1F` : inputBg,
                borderColor: statusFilter === key ? color : cardBorder,
              }}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color }}>
                  {label}
                </span>
                <span className="text-2xl font-bold font-mono" style={{ color: textPrimary }}>
                  {counts[key]}
                </span>
              </div>
              <Icon size={22} color={color} />
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
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
              {tab === "all" ? "All Skills" : tab}
            </button>
          ))}
        </div>
        <span className="text-xs font-mono" style={{ color: textMuted }}>
          Showing {skills.length} skill{skills.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-4 rounded-xl border flex items-center gap-3 text-xs"
          style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)", color: "#EF4444" }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={24} className="animate-spin text-sky-500" />
          <span className="text-xs" style={{ color: textMuted }}>
            Reading skill files from disk...
          </span>
        </div>
      ) : skills.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border"
          style={{ background: cardBg, borderColor: cardBorder }}
        >
          <Wrench size={36} className="mb-3 opacity-40" style={{ color: textMuted }} />
          <h4 className="text-sm font-semibold" style={{ color: textPrimary }}>
            No {statusFilter === "all" ? "" : statusFilter} skills found
          </h4>
          <p className="text-xs max-w-md mt-1" style={{ color: textMuted }}>
            {statusFilter === "quarantined"
              ? "When the agent completes tasks using its tools, it reflects and writes reusable skills here for your review."
              : "No skills match the selected status filter."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <AnimatePresence>
            {skills.map((skill) => {
              const isQuarantined = skill.status === "quarantined";
              const isApproved = skill.status === "approved";
              const isActioning = actionLoadingId === skill.id;

              return (
                <motion.div
                  key={skill.id}
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
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5"
                        style={{
                          background: isQuarantined
                            ? "rgba(245,158,11,0.15)"
                            : isApproved
                            ? "rgba(34,197,94,0.15)"
                            : "rgba(113,113,122,0.15)",
                          color: isQuarantined ? "#F59E0B" : isApproved ? "#22C55E" : "#71717A",
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
                        {skill.status}
                      </span>
                      <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>
                        {skill.title || skill.id}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs" style={{ color: textMuted }}>
                      <span className="px-2 py-0.5 rounded bg-black/20 font-mono text-[10px]">{skill.category}</span>
                      <span>
                        Confidence:{" "}
                        <strong className="font-mono text-sky-400">{Math.round(skill.confidence * 100)}%</strong>
                      </span>
                      <span className="text-[11px]">{new Date(skill.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Outcome stats — the reward loop made visible */}
                  <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: textMuted }}>
                    <span className="flex items-center gap-1.5">
                      <Repeat size={13} className="text-sky-400" />
                      Retrieved <strong className="font-mono" style={{ color: textPrimary }}>{skill.times_retrieved}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <TrendingUp size={13} className="text-green-400" />
                      Successes <strong className="font-mono" style={{ color: textPrimary }}>{skill.times_succeeded}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <TrendingDown size={13} className="text-red-400" />
                      Failures <strong className="font-mono" style={{ color: textPrimary }}>{skill.times_failed}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      Success rate <strong className="font-mono text-sky-400">{successRate(skill)}</strong>
                    </span>
                  </div>

                  {/* Skill body (markdown source) */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <FileText size={12} />
                      Skill Playbook (markdown file)
                    </span>
                    <div
                      className="p-3.5 rounded-xl border font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto"
                      style={{ background: isDark ? "#09090B" : "#F4F4F5", borderColor: cardBorder, color: textPrimary }}
                    >
                      {skill.body}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2 border-t" style={{ borderColor: cardBorder }}>
                    {isQuarantined && (
                      <>
                        <button
                          onClick={() => postAction("reject", skill.id)}
                          disabled={isActioning}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:bg-red-500/10 cursor-pointer"
                          style={{ color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}
                        >
                          <XCircle size={14} />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => postAction("approve", skill.id)}
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
                        onClick={() => postAction("reject", skill.id)}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:bg-amber-500/10 cursor-pointer"
                        style={{ color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}
                      >
                        {isActioning ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                        <span>Deprecate Skill</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
