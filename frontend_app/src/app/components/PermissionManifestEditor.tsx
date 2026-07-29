/**
 * PermissionManifestEditor.tsx
 *
 * Visual YAML Permission Manifest Editor for Agentic Execution Layer (MCP).
 * Allows security administrators to configure allowed read/write filesystem paths,
 * allowlisted shell commands, forbidden execution patterns, and browser domain policies.
 */

import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import {
  Shield,
  Save,
  Plus,
  X,
  Folder,
  Terminal,
  Globe,
  AlertOctagon,
  Check,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface PermissionSchema {
  filesystem: {
    allowed_read_paths: string[];
    allowed_write_paths: string[];
    forbidden_paths: string[];
  };
  shell: {
    allowed_commands: string[];
    forbidden_patterns: string[];
  };
  browser: {
    allowed_domains: string[];
  };
}

interface PermissionManifestEditorProps {
  isDark: boolean;
  sessionUrl: string | null;
  adminPassword: string;
}

export function PermissionManifestEditor({ isDark, sessionUrl, adminPassword }: PermissionManifestEditorProps) {
  const [manifest, setManifest] = useState<PermissionSchema>({
    filesystem: { allowed_read_paths: [], allowed_write_paths: [], forbidden_paths: [] },
    shell: { allowed_commands: [], forbidden_patterns: [] },
    browser: { allowed_domains: [] },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // New item input states
  const [newReadPath, setNewReadPath] = useState("");
  const [newWritePath, setNewWritePath] = useState("");
  const [newForbiddenPath, setNewForbiddenPath] = useState("");
  const [newShellCmd, setNewShellCmd] = useState("");
  const [newForbiddenPat, setNewForbiddenPat] = useState("");
  const [newDomain, setNewDomain] = useState("");

  // Styling Tokens
  const cardBg = isDark ? "rgba(20, 20, 20, 0.85)" : "rgba(255, 255, 255, 0.9)";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const textPrimary = isDark ? "#F4F4F5" : "#18181B";
  const textMuted = isDark ? "#A1A1AA" : "#71717A";
  const inputBg = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";

  const fetchManifest = useCallback(async () => {
    if (!sessionUrl) return;
    setLoading(true);
    setError(null);
    try {
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/admin/permissions`, {
        method: "GET",
        headers: {
          password: adminPassword,
          "ngrok-skip-browser-warning": "bypass",
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load permissions (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (data.permissions) {
        setManifest(data.permissions);
      }
    } catch (err: any) {
      setError(err?.message || "Error loading permission manifest.");
    } finally {
      setLoading(false);
    }
  }, [sessionUrl, adminPassword]);

  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  const handleSave = async () => {
    if (!sessionUrl) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/admin/permissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          password: adminPassword,
        },
        body: JSON.stringify({ permissions: manifest }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await res.json();
        throw new Error(data.detail || "Failed to update permission manifest.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  // Helper Array Modifiers
  const addToList = (section: "filesystem" | "shell" | "browser", key: string, value: string, resetFn: (v: string) => void) => {
    if (!value.trim()) return;
    setManifest((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: [...prev[section][key], value.trim()],
      },
    }));
    resetFn("");
  };

  const removeFromList = (section: "filesystem" | "shell" | "browser", key: string, index: number) => {
    setManifest((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: prev[section][key].filter((_: any, i: number) => i !== index),
      },
    }));
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
              background: isDark ? "rgba(168,85,247,0.15)" : "rgba(147,51,234,0.1)",
              border: `1px solid ${isDark ? "rgba(168,85,247,0.3)" : "rgba(147,51,234,0.2)"}`,
            }}
          >
            <Shield size={24} color={isDark ? "#C084FC" : "#9333EA"} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: textPrimary }}>
                Security Permission Manifest
              </h2>
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider"
                style={{
                  background: isDark ? "rgba(168,85,247,0.15)" : "rgba(147,51,234,0.12)",
                  color: isDark ? "#C084FC" : "#9333EA",
                  border: `1px solid ${isDark ? "rgba(168,85,247,0.25)" : "rgba(147,51,234,0.25)"}`,
                }}
              >
                ~/.aethel/permissions.yaml
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: textMuted }}>
              Strict isolation rules governing filesystem reads/writes, shell execution allowlists, and web domain access.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {success && (
            <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
              <CheckCircle size={15} />
              <span>Manifest Saved!</span>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-md"
            style={{ background: "#A855F7", color: "#FFFFFF" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save Manifest</span>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-xl border flex items-center gap-3 text-xs bg-red-500/10 border-red-500/30 text-red-400">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={24} className="animate-spin text-purple-400" />
          <span className="text-xs" style={{ color: textMuted }}>
            Loading permission manifest policies...
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SECTION 1: Filesystem Read Paths */}
          <div className="rounded-2xl p-5 border flex flex-col gap-4" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="flex items-center gap-2">
              <Folder size={16} className="text-sky-400" />
              <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>
                Allowed Read Paths
              </h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newReadPath}
                onChange={(e) => setNewReadPath(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToList("filesystem", "allowed_read_paths", newReadPath, setNewReadPath)}
                placeholder="e.g. C:/Users/name/Documents"
                className="flex-1 px-3 py-2 rounded-xl text-xs font-mono outline-none border focus:border-sky-400"
                style={{ background: inputBg, borderColor: cardBorder, color: textPrimary }}
              />
              <button
                onClick={() => addToList("filesystem", "allowed_read_paths", newReadPath, setNewReadPath)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30 hover:bg-sky-500/30 transition-all cursor-pointer"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[60px]">
              {manifest.filesystem.allowed_read_paths.map((p, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-mono bg-sky-500/10 text-sky-300 border border-sky-500/20 flex items-center gap-1.5">
                  {p}
                  <button onClick={() => removeFromList("filesystem", "allowed_read_paths", idx)} className="hover:text-red-400">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* SECTION 2: Filesystem Write Paths */}
          <div className="rounded-2xl p-5 border flex flex-col gap-4" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="flex items-center gap-2">
              <Folder size={16} className="text-purple-400" />
              <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>
                Allowed Write Paths
              </h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newWritePath}
                onChange={(e) => setNewWritePath(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToList("filesystem", "allowed_write_paths", newWritePath, setNewWritePath)}
                placeholder="e.g. C:/Users/name/Documents/ai-tasks"
                className="flex-1 px-3 py-2 rounded-xl text-xs font-mono outline-none border focus:border-purple-400"
                style={{ background: inputBg, borderColor: cardBorder, color: textPrimary }}
              />
              <button
                onClick={() => addToList("filesystem", "allowed_write_paths", newWritePath, setNewWritePath)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-all cursor-pointer"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[60px]">
              {manifest.filesystem.allowed_write_paths.map((p, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1.5">
                  {p}
                  <button onClick={() => removeFromList("filesystem", "allowed_write_paths", idx)} className="hover:text-red-400">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* SECTION 3: Forbidden Paths */}
          <div className="rounded-2xl p-5 border flex flex-col gap-4" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="flex items-center gap-2">
              <AlertOctagon size={16} className="text-red-400" />
              <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>
                Forbidden Filesystem Paths
              </h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newForbiddenPath}
                onChange={(e) => setNewForbiddenPath(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToList("filesystem", "forbidden_paths", newForbiddenPath, setNewForbiddenPath)}
                placeholder="e.g. C:/Windows"
                className="flex-1 px-3 py-2 rounded-xl text-xs font-mono outline-none border focus:border-red-400"
                style={{ background: inputBg, borderColor: cardBorder, color: textPrimary }}
              />
              <button
                onClick={() => addToList("filesystem", "forbidden_paths", newForbiddenPath, setNewForbiddenPath)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all cursor-pointer"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[60px]">
              {manifest.filesystem.forbidden_paths.map((p, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-mono bg-red-500/10 text-red-300 border border-red-500/20 flex items-center gap-1.5">
                  {p}
                  <button onClick={() => removeFromList("filesystem", "forbidden_paths", idx)} className="hover:text-red-400">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* SECTION 4: Shell Allowed Commands */}
          <div className="rounded-2xl p-5 border flex flex-col gap-4" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-amber-400" />
              <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>
                Allowed Shell Commands
              </h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newShellCmd}
                onChange={(e) => setNewShellCmd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToList("shell", "allowed_commands", newShellCmd, setNewShellCmd)}
                placeholder="e.g. git status"
                className="flex-1 px-3 py-2 rounded-xl text-xs font-mono outline-none border focus:border-amber-400"
                style={{ background: inputBg, borderColor: cardBorder, color: textPrimary }}
              />
              <button
                onClick={() => addToList("shell", "allowed_commands", newShellCmd, setNewShellCmd)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all cursor-pointer"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[60px]">
              {manifest.shell.allowed_commands.map((cmd, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1.5">
                  {cmd}
                  <button onClick={() => removeFromList("shell", "allowed_commands", idx)} className="hover:text-red-400">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* SECTION 5: Shell Forbidden Patterns */}
          <div className="rounded-2xl p-5 border flex flex-col gap-4" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="flex items-center gap-2">
              <AlertOctagon size={16} className="text-red-400" />
              <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>
                Forbidden Shell Command Patterns
              </h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newForbiddenPat}
                onChange={(e) => setNewForbiddenPat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToList("shell", "forbidden_patterns", newForbiddenPat, setNewForbiddenPat)}
                placeholder="e.g. rm -rf"
                className="flex-1 px-3 py-2 rounded-xl text-xs font-mono outline-none border focus:border-red-400"
                style={{ background: inputBg, borderColor: cardBorder, color: textPrimary }}
              />
              <button
                onClick={() => addToList("shell", "forbidden_patterns", newForbiddenPat, setNewForbiddenPat)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all cursor-pointer"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[60px]">
              {manifest.shell.forbidden_patterns.map((pat, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-mono bg-red-500/10 text-red-300 border border-red-500/20 flex items-center gap-1.5">
                  {pat}
                  <button onClick={() => removeFromList("shell", "forbidden_patterns", idx)} className="hover:text-red-400">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* SECTION 6: Browser Allowed Domains */}
          <div className="rounded-2xl p-5 border flex flex-col gap-4" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-cyan-400" />
              <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>
                Browser Allowed Domains
              </h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToList("browser", "allowed_domains", newDomain, setNewDomain)}
                placeholder="e.g. * or github.com"
                className="flex-1 px-3 py-2 rounded-xl text-xs font-mono outline-none border focus:border-cyan-400"
                style={{ background: inputBg, borderColor: cardBorder, color: textPrimary }}
              />
              <button
                onClick={() => addToList("browser", "allowed_domains", newDomain, setNewDomain)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all cursor-pointer"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[60px]">
              {manifest.browser.allowed_domains.map((dom, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1.5">
                  {dom}
                  <button onClick={() => removeFromList("browser", "allowed_domains", idx)} className="hover:text-red-400">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
