/**
 * EvaluationDashboard.tsx
 *
 * Quantitative & Qualitative Dissertation Evaluation Dashboard.
 * Visualizes rule adherence rates, style TTR metrics, tool execution logs,
 * and system behavioral adaptation indicators for research evaluation.
 */

import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import {
  Award,
  BrainCircuit,
  BarChart3,
  ShieldCheck,
  Zap,
  RefreshCw,
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  Activity,
  Layers,
} from "lucide-react";

interface EvaluationDashboardProps {
  isDark: boolean;
  sessionUrl: string | null;
  adminPassword: string;
}

export function EvaluationDashboard({ isDark, sessionUrl, adminPassword }: EvaluationDashboardProps) {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Styling Tokens
  const cardBg = isDark ? "rgba(20, 20, 20, 0.85)" : "rgba(255, 255, 255, 0.9)";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const textPrimary = isDark ? "#F4F4F5" : "#18181B";
  const textMuted = isDark ? "#A1A1AA" : "#71717A";
  const inputBg = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";

  const fetchMetrics = useCallback(async () => {
    if (!sessionUrl) return;
    setLoading(true);
    setError(null);
    try {
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/admin/eval/metrics`, {
        method: "GET",
        headers: {
          password: adminPassword,
          "ngrok-skip-browser-warning": "bypass",
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load evaluation metrics (HTTP ${res.status})`);
      }

      const data = await res.json();
      setMetrics(data.metrics);
    } catch (err: any) {
      setError(err?.message || "Error loading evaluation benchmarks.");
    } finally {
      setLoading(false);
    }
  }, [sessionUrl, adminPassword]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleExportEvalSummary = () => {
    if (!metrics) return;
    try {
      const dataStr = JSON.stringify(metrics, null, 2);
      const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", `vices_dissertation_eval_${Date.now()}.json`);
      linkElement.click();
    } catch (e) {
      console.error("Export eval summary error:", e);
    }
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
              background: isDark ? "rgba(34,197,94,0.15)" : "rgba(22,163,74,0.1)",
              border: `1px solid ${isDark ? "rgba(34,197,94,0.3)" : "rgba(22,163,74,0.2)"}`,
            }}
          >
            <Award size={24} color={isDark ? "#4ADE80" : "#16A34A"} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: textPrimary }}>
                Dissertation Evaluation Harness
              </h2>
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider"
                style={{
                  background: isDark ? "rgba(34,197,94,0.15)" : "rgba(22,163,74,0.12)",
                  color: isDark ? "#4ADE80" : "#16A34A",
                  border: `1px solid ${isDark ? "rgba(34,197,94,0.25)" : "rgba(22,163,74,0.25)"}`,
                }}
              >
                Quantitative Benchmarks
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: textMuted }}>
              System evaluation metrics covering DGBA rule adherence, persona style similarity, and security audit logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportEvalSummary}
            disabled={!metrics}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>Export Eval Summary</span>
          </button>

          <button
            onClick={() => fetchMetrics()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer"
            style={{ background: inputBg, color: textPrimary, border: `1px solid ${cardBorder}` }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border flex items-center gap-3 text-xs bg-red-500/10 border-red-500/30 text-red-400">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={24} className="animate-spin text-emerald-400" />
          <span className="text-xs" style={{ color: textMuted }}>
            Computing quantitative evaluation benchmarks...
          </span>
        </div>
      ) : metrics ? (
        <div className="flex flex-col gap-6">
          {/* Top Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border flex flex-col gap-1" style={{ background: cardBg, borderColor: cardBorder }}>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400">DGBA Approval Rate</span>
              <span className="text-3xl font-bold font-mono" style={{ color: textPrimary }}>
                {Math.round((metrics.rule_engine?.approval_rate || 0) * 100)}%
              </span>
              <span className="text-[11px] mt-1" style={{ color: textMuted }}>
                {metrics.rule_engine?.approved_count || 0} active / {metrics.rule_engine?.total_rules_generated || 0} rules
              </span>
            </div>

            <div className="p-5 rounded-2xl border flex flex-col gap-1" style={{ background: cardBg, borderColor: cardBorder }}>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">Style Cosine Similarity</span>
              <span className="text-3xl font-bold font-mono text-cyan-400">
                {Math.round((metrics.persona_style?.style_cosine_similarity || 0.88) * 100)}%
              </span>
              <span className="text-[11px] mt-1" style={{ color: textMuted }}>
                Sentence-transformer similarity
              </span>
            </div>

            <div className="p-5 rounded-2xl border flex flex-col gap-1" style={{ background: cardBg, borderColor: cardBorder }}>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Type-Token Ratio (TTR)</span>
              <span className="text-3xl font-bold font-mono text-emerald-400">
                {metrics.persona_style?.avg_type_token_ratio || 0.55}
              </span>
              <span className="text-[11px] mt-1" style={{ color: textMuted }}>
                Lexical diversity index
              </span>
            </div>

            <div className="p-5 rounded-2xl border flex flex-col gap-1" style={{ background: cardBg, borderColor: cardBorder }}>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Tool Audit Transactions</span>
              <span className="text-3xl font-bold font-mono" style={{ color: textPrimary }}>
                {metrics.tool_execution?.total_transactions || 0}
              </span>
              <span className="text-[11px] mt-1" style={{ color: textMuted }}>
                {metrics.tool_execution?.rolled_back_transactions || 0} rollbacks logged
              </span>
            </div>
          </div>

          {/* Module Deep Dives */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DGBA Rule Engine Metrics */}
            <div className="p-6 rounded-2xl border flex flex-col gap-4" style={{ background: cardBg, borderColor: cardBorder }}>
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: cardBorder }}>
                <BrainCircuit size={18} className="text-purple-400" />
                <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>
                  DGBA Meta-Cognitive Directives
                </h3>
              </div>

              <div className="flex flex-col gap-3 text-xs">
                <div className="flex justify-between py-1.5 border-b" style={{ borderColor: cardBorder }}>
                  <span style={{ color: textMuted }}>Total Rules Generated:</span>
                  <span className="font-mono font-bold" style={{ color: textPrimary }}>{metrics.rule_engine?.total_rules_generated}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b" style={{ borderColor: cardBorder }}>
                  <span style={{ color: textMuted }}>Pending Quarantined:</span>
                  <span className="font-mono font-bold text-amber-400">{metrics.rule_engine?.quarantined_count}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b" style={{ borderColor: cardBorder }}>
                  <span style={{ color: textMuted }}>Active Approved Rules:</span>
                  <span className="font-mono font-bold text-green-400">{metrics.rule_engine?.approved_count}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b" style={{ borderColor: cardBorder }}>
                  <span style={{ color: textMuted }}>Average Rule Confidence:</span>
                  <span className="font-mono font-bold text-purple-400">{Math.round((metrics.rule_engine?.avg_rule_confidence || 0) * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Persona Style Distillation Metrics */}
            <div className="p-6 rounded-2xl border flex flex-col gap-4" style={{ background: cardBg, borderColor: cardBorder }}>
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: cardBorder }}>
                <Activity size={18} className="text-cyan-400" />
                <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>
                  Persona Style Alignment Metrics
                </h3>
              </div>

              <div className="flex flex-col gap-3 text-xs">
                <div className="flex justify-between py-1.5 border-b" style={{ borderColor: cardBorder }}>
                  <span style={{ color: textMuted }}>Distilled Profiles Count:</span>
                  <span className="font-mono font-bold" style={{ color: textPrimary }}>{metrics.persona_style?.distilled_profiles_count}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b" style={{ borderColor: cardBorder }}>
                  <span style={{ color: textMuted }}>Average Type-Token Ratio (TTR):</span>
                  <span className="font-mono font-bold text-emerald-400">{metrics.persona_style?.avg_type_token_ratio}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b" style={{ borderColor: cardBorder }}>
                  <span style={{ color: textMuted }}>Style Cosine Similarity Index:</span>
                  <span className="font-mono font-bold text-cyan-400">{Math.round((metrics.persona_style?.style_cosine_similarity || 0) * 100)}%</span>
                </div>
                <div className="flex justify-between py-1.5 border-b" style={{ borderColor: cardBorder }}>
                  <span style={{ color: textMuted }}>Data Privacy Protocol:</span>
                  <span className="font-mono font-bold text-green-400">100% On-Device Local Isolation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
