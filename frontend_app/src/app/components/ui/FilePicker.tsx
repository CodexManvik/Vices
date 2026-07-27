/**
 * FilePicker.tsx — an in-app file browser backed by the /system/browse endpoint.
 *
 * Lets the user navigate the whole PC and pick a model file anywhere, without
 * relying on a native OS dialog (which Tauri's webview can't always open).
 * Filters to given extensions; directories are always shown for navigation.
 */
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { X, Folder, FileText, ChevronUp, Loader2, HardDrive, Check } from "lucide-react";

interface Entry {
  name: string;
  path: string;
  is_dir: boolean;
  size_mb?: number;
}

interface FilePickerProps {
  sessionUrl: string | null;
  exts?: string;            // e.g. "gguf,safetensors"
  startPath?: string;       // initial directory
  title?: string;
  onPick: (path: string) => void;
  onClose: () => void;
}

export function FilePicker({ sessionUrl, exts, startPath, title = "Select a file", onPick, onClose }: FilePickerProps) {
  const base = (sessionUrl || "http://localhost:8000").replace(/\/+$/, "");
  const [path, setPath] = useState<string | undefined>(startPath);
  const [parent, setParent] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const browse = useCallback(async (target?: string) => {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const q = new URLSearchParams();
      if (target) q.set("path", target);
      if (exts) q.set("exts", exts);
      const res = await fetch(`${base}/system/browse?${q.toString()}`);
      if (!res.ok) throw new Error(`Cannot open folder (HTTP ${res.status})`);
      const data = await res.json();
      setPath(data.path || undefined);
      setParent(data.parent);
      setEntries(data.entries || []);
    } catch (e: any) {
      setError(e?.message || "Failed to browse.");
    } finally {
      setLoading(false);
    }
  }, [base, exts]);

  useEffect(() => {
    browse(startPath);
  }, [browse, startPath]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg h-[70vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "var(--v-bg-elev)", border: "1px solid var(--v-border-strong)", boxShadow: "var(--v-shadow-lg)" }}
      >
        {/* header */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--v-border)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--v-text)" }}>{title}</span>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--v-surface-2)]" style={{ color: "var(--v-text-muted)" }}>
            <X size={17} />
          </button>
        </div>

        {/* current path + up */}
        <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid var(--v-border)" }}>
          <button
            onClick={() => browse(parent || undefined)}
            disabled={!parent}
            className="p-1.5 rounded-md disabled:opacity-30 hover:bg-[var(--v-surface-2)]"
            style={{ color: "var(--v-text-muted)" }}
            title="Up one level"
          >
            <ChevronUp size={16} />
          </button>
          <span className="text-[11px] font-mono truncate flex-1" style={{ color: "var(--v-text-faint)" }}>
            {path || "This PC"}
          </span>
        </div>

        {/* listing */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--v-accent)" }} />
            </div>
          ) : error ? (
            <div className="p-3 text-[12px]" style={{ color: "var(--v-danger)" }}>{error}</div>
          ) : entries.length === 0 ? (
            <div className="p-4 text-[12px] text-center" style={{ color: "var(--v-text-faint)" }}>
              No matching files here. Open a subfolder or go up.
            </div>
          ) : (
            entries.map((e) => (
              <button
                key={e.path}
                onClick={() => (e.is_dir ? browse(e.path) : setSelected(e.path))}
                className="w-full px-2.5 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors"
                style={{ background: selected === e.path ? "var(--v-accent-soft)" : "transparent" }}
                onDoubleClick={() => !e.is_dir && onPick(e.path)}
              >
                {e.path.match(/^[A-Z]:\\$/) ? (
                  <HardDrive size={15} style={{ color: "var(--v-text-muted)" }} />
                ) : e.is_dir ? (
                  <Folder size={15} style={{ color: "var(--v-accent)" }} />
                ) : (
                  <FileText size={15} style={{ color: "var(--v-text-muted)" }} />
                )}
                <span className="flex-1 truncate text-[12.5px]" style={{ color: "var(--v-text)" }}>
                  {e.name}
                </span>
                {!e.is_dir && e.size_mb != null && (
                  <span className="text-[10.5px] shrink-0" style={{ color: "var(--v-text-faint)" }}>
                    {e.size_mb >= 1024 ? `${(e.size_mb / 1024).toFixed(1)} GB` : `${e.size_mb} MB`}
                  </span>
                )}
                {selected === e.path && <Check size={14} style={{ color: "var(--v-accent)" }} />}
              </button>
            ))
          )}
        </div>

        {/* footer */}
        <div className="px-4 py-3 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--v-border)" }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ border: "1px solid var(--v-border)", color: "var(--v-text-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onPick(selected)}
            disabled={!selected}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: "var(--v-accent)", color: "var(--v-accent-contrast)" }}
          >
            Select
          </button>
        </div>
      </motion.div>
    </div>
  );
}
