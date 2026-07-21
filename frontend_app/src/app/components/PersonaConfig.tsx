/**
 * PersonaConfig.tsx
 *
 * Visual dashboard/modal to manage multiple VICES companion personas.
 * Users can switch active companions (max 2), edit, delete, or add new ones.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  User,
  Heart,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  Shield,
  Loader2,
  CheckCircle,
  AlertCircle,
  Check,
} from "lucide-react";
import { PersonaSetup } from "./PersonaSetup";
import { useAgeGate, AgeGateModal } from "./AgeGateModal";
import { PersonaDistillationWizard } from "./PersonaDistillationWizard";

export interface Companion {
  id: string;
  name: string;
  gender: string;
  age: number;
  relationship_style: string;
  custom_description: string;
  user_name: string;
  nsfw: boolean;
  physical_traits?: {
    hips_size?: string;
    waist_size?: string;
    bust_size?: string;
    skin_tone?: string;
    hair_color?: string;
    eye_color?: string;
  };
  system_prompt: string;
  created_at: string;
}

interface PersonaConfigProps {
  isDark: boolean;
  sessionUrl: string | null;
  onClose: () => void;
  onActiveChanged?: () => void;
}

const T = {
  bg: (dark: boolean) => (dark ? "#060606" : "#FAFAF9"),
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

/** Sentinel ID that identifies the hardcoded built-in Rosia persona. */
const ROSIA_BUILTIN_ID = "rosia_builtin";

export function PersonaConfig({
  isDark,
  sessionUrl,
  onClose,
  onActiveChanged,
}: PersonaConfigProps) {
  const [loading, setLoading] = useState(true);
  const [personas, setPersonas] = useState<Companion[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sub-navigation state: "list" | "create" | "edit"
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingCompanion, setEditingCompanion] = useState<Companion | null>(null);
  const [distillCompanion, setDistillCompanion] = useState<Companion | null>(null);

  // Edit form state variables
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editAge, setEditAge] = useState(18);
  const [editStyle, setEditStyle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editUserName, setEditUserName] = useState("");
  const [editNsfw, setEditNsfw] = useState(false);
  const { isAdultVerified, requestVerification, gateOpen, handleConfirm, handleDismiss } = useAgeGate();

  const handleEditNsfwToggle = () => {
    if (!editNsfw && !isAdultVerified) {
      requestVerification(() => setEditNsfw(true));
    } else {
      setEditNsfw((n) => !n);
    }
  };
  const [editHips, setEditHips] = useState("");
  const [editWaist, setEditWaist] = useState("");
  const [editBust, setEditBust] = useState("");
  const [editSkin, setEditSkin] = useState("");
  const [editHair, setEditHair] = useState("");
  const [editEye, setEditEye] = useState("");
  const [regeneratePrompt, setRegeneratePrompt] = useState(true);

  const fetchUrl = (sessionUrl || "http://localhost:8000").replace(/\/+$/, "");

  const loadPersonas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${fetchUrl}/personas`, {
        headers: {
        },
      });
      if (res.ok) {
        const data = await res.json();
        setPersonas(data.personas || []);
        setActiveId(data.active_id || null);
      } else {
        throw new Error("Failed to retrieve personas");
      }
    } catch (err: any) {
      setError(err?.message || "Error connecting to the backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersonas();
  }, [sessionUrl]);

  const handleActivate = async (id: string) => {
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("persona_id", id);

      const res = await fetch(`${fetchUrl}/personas/activate`, {
        method: "POST",
        headers: {
        },
        body: formData,
      });

      if (res.ok) {
        setActiveId(id);
        setSuccess("Active companion switched!");
        if (onActiveChanged) onActiveChanged();
        setTimeout(() => setSuccess(null), 2000);
      } else {
        throw new Error("Activation request failed");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to switch active companion");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this companion? This will delete all physical configuration and their synthesized prompt.")) return;

    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${fetchUrl}/personas/${id}`, {
        method: "DELETE",
        headers: {
        },
      });

      if (res.ok) {
        setSuccess("Companion deleted.");
        setPersonas((prev) => prev.filter((p) => p.id !== id));
        if (activeId === id) {
          // Trigger parent refresh to update core state
          if (onActiveChanged) onActiveChanged();
        }
        await loadPersonas();
        setTimeout(() => setSuccess(null), 2000);
      } else {
        throw new Error("Deletion failed");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to delete companion");
    }
  };

  const startEdit = (companion: Companion, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCompanion(companion);
    setEditName(companion.name);
    setEditGender(companion.gender);
    setEditAge(companion.age);
    setEditStyle(companion.relationship_style);
    setEditDesc(companion.custom_description);
    setEditUserName(companion.user_name);
    setEditNsfw(companion.nsfw);
    
    const pt = companion.physical_traits || {};
    setEditHips(pt.hips_size || "natural");
    setEditWaist(pt.waist_size || "slim");
    setEditBust(pt.bust_size || "average");
    setEditSkin(pt.skin_tone || "fair");
    setEditHair(pt.hair_color || "brunette");
    setEditEye(pt.eye_color || "brown");

    setRegeneratePrompt(true);
    setView("edit");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editUserName.trim() || !editDesc.trim()) {
      setError("Please fill out all required fields.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: editName,
        gender: editGender,
        age: editAge,
        relationship_style: editStyle,
        custom_description: editDesc,
        user_name: editUserName,
        nsfw: editNsfw,
        physical_traits: editNsfw
          ? {
              hips_size: editHips,
              waist_size: editWaist,
              bust_size: editBust,
              skin_tone: editSkin,
              hair_color: editHair,
              eye_color: editEye,
            }
          : null,
        regenerate_prompt: regeneratePrompt,
      };

      const res = await fetch(`${fetchUrl}/personas/${editingCompanion?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Age-Verified": localStorage.getItem("vices_age_verified") || "false",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccess("Companion profile updated!");
        setView("list");
        if (onActiveChanged) onActiveChanged();
        await loadPersonas();
        setTimeout(() => setSuccess(null), 2000);
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || "Edit request failed");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to update companion");
    } finally {
      setLoading(false);
    }
  };

  if (view === "create") {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <PersonaSetup
          isDark={isDark}
          sessionUrl={sessionUrl}
          onComplete={async () => {
            setView("list");
            if (onActiveChanged) onActiveChanged();
            await loadPersonas();
          }}
          allowCancel={true}
          onCancel={() => setView("list")}
        />
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6 overflow-hidden"
        style={{
          background: isDark ? "rgba(0,0,0,0.85)" : "rgba(28,25,23,0.4)",
          backdropFilter: "blur(8px)",
        }}
      >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="w-full max-w-4xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{
          background: T.card(isDark),
          border: `1px solid ${T.cardBorder(isDark)}`,
          boxShadow: isDark ? "0 24px 64px rgba(0,0,0,0.8)" : "0 12px 32px rgba(0,0,0,0.08)",
          color: T.text(isDark),
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4" style={{ borderBottom: `1px solid ${T.separator(isDark)}` }}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: T.accent }} />
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "22px",
                fontWeight: 500,
                letterSpacing: "0.08em",
              }}
            >
              Configure Persona Core
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors hover:bg-white/[0.04] active:bg-white/[0.08]"
            style={{ color: T.muted(isDark) }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Messaging banners */}
        {error && (
          <div className="px-6 pt-4">
            <div
              className="p-3 rounded-lg flex items-start gap-2.5"
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.15)",
                color: "#F87171",
                fontSize: "12px",
              }}
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </div>
        )}
        {success && (
          <div className="px-6 pt-4">
            <div
              className="p-3 rounded-lg flex items-start gap-2.5"
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.15)",
                color: "#34D399",
                fontSize: "12px",
              }}
            >
              <CheckCircle size={15} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          </div>
        )}

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin" style={{ color: T.muted(isDark) }} />
              <span style={{ fontSize: "12.5px", color: T.muted(isDark) }}>Syncing companion registries...</span>
            </div>
          ) : view === "list" ? (
            <div className="flex flex-col gap-6">
              {personas.length === 0 ? (
                <div
                  className="rounded-xl p-8 flex flex-col items-center justify-center text-center gap-4 border border-dashed"
                  style={{ borderColor: T.cardBorder(isDark) }}
                >
                  <User size={28} style={{ color: T.dim(isDark) }} />
                  <div className="flex flex-col gap-1">
                    <span style={{ fontSize: "14px", fontWeight: 500 }}>No Custom Companions Found</span>
                    <span style={{ fontSize: "12px", color: T.muted(isDark), maxWidth: "320px", lineHeight: 1.5 }}>
                      Rosia (built-in) is available. You can also build a custom companion below.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setView("create")}
                    className="px-4 py-2 mt-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                    style={{ background: T.accent, color: "#060606" }}
                  >
                    <Plus size={13} />
                    <span>Create Companion</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize: "12px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      My Companions ({personas.length} custom{personas.length !== 1 ? " · Rosia built-in" : " · Rosia built-in"})
                    </span>
                    {personas.length < 2 && (
                      <button
                        type="button"
                        onClick={() => setView("create")}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all hover:bg-white/[0.04]"
                        style={{ border: `1px solid ${T.cardBorder(isDark)}`, color: T.text(isDark) }}
                      >
                        <Plus size={12} />
                        <span>Add Companion</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* ── Built-in Rosia Card (always first, cannot be deleted) ── */}
                    {(() => {
                      const isRosiaActive = activeId === ROSIA_BUILTIN_ID;
                      return (
                        <div
                          onClick={() => handleActivate(ROSIA_BUILTIN_ID)}
                          className="rounded-xl p-5 cursor-pointer flex flex-col gap-4 border transition-all relative group"
                          style={{
                            background: isDark ? "rgba(56,189,248,0.02)" : "rgba(56,189,248,0.03)",
                            borderColor: isRosiaActive ? T.accent : T.cardBorder(isDark),
                            boxShadow: isRosiaActive
                              ? isDark
                                ? "0 8px 32px rgba(56,189,248,0.08)"
                                : "0 8px 32px rgba(56,189,248,0.12)"
                              : "none",
                          }}
                        >
                          {isRosiaActive && (
                            <div
                              className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider"
                              style={{ background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}` }}
                            >
                              <Check size={10} />
                              <span>Active</span>
                            </div>
                          )}
                          <div className="flex flex-col gap-1 pr-14">
                            <div className="flex items-center gap-2">
                              <span style={{ fontSize: "16px", fontWeight: 500 }}>Rosia</span>
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-semibold"
                                style={{
                                  background: "rgba(56,189,248,0.1)",
                                  color: T.accent,
                                  border: `1px solid rgba(56,189,248,0.2)`,
                                }}
                              >
                                Built-in
                              </span>
                            </div>
                            <span style={{ fontSize: "11px", color: T.muted(isDark) }}>Female · Adaptive AI</span>
                          </div>
                          <div className="flex flex-col gap-2" style={{ fontSize: "12px", borderTop: `1px solid ${T.separator(isDark)}`, paddingTop: "12px" }}>
                            <div className="flex justify-between mt-1">
                              <span style={{ color: T.muted(isDark) }}>Relationship style:</span>
                              <span className="font-medium">Intimate companion</span>
                            </div>
                            <div className="flex justify-between">
                              <span style={{ color: T.muted(isDark) }}>Safety Boundaries:</span>
                              <span className="font-medium">Context-aware</span>
                            </div>
                            <div className="flex flex-col gap-1 mt-1">
                              <span style={{ color: T.muted(isDark) }}>Personality / Backstory:</span>
                              <span className="line-clamp-2 text-xs italic" style={{ color: T.dim(isDark), lineHeight: 1.4 }}>
                                "Hardcoded core persona. Deeply curious, emotionally present, and brutally honest."
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-2">
                            <span style={{ fontSize: "11px", color: T.dim(isDark), fontStyle: "italic" }}>Hardcoded · cannot be edited</span>
                          </div>
                        </div>
                      );
                    })()}

                    {personas.map((companion) => {
                      const isActive = activeId === companion.id;
                      return (
                        <div
                          key={companion.id}
                          onClick={() => handleActivate(companion.id)}
                          className="rounded-xl p-5 cursor-pointer flex flex-col gap-4 border transition-all relative group"
                          style={{
                            background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
                            borderColor: isActive ? T.accent : T.cardBorder(isDark),
                            boxShadow: isActive
                              ? isDark
                                ? "0 8px 32px rgba(56,189,248,0.08)"
                                : "0 8px 32px rgba(56,189,248,0.12)"
                              : "none",
                          }}
                        >
                          {/* Active Indicator Pin */}
                          {isActive && (
                            <div
                              className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider text-uppercase"
                              style={{ background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}` }}
                            >
                              <Check size={10} />
                              <span>Active</span>
                            </div>
                          )}

                          {/* Companion Identity Header */}
                          <div className="flex flex-col gap-1 pr-14">
                            <span style={{ fontSize: "16px", fontWeight: 500 }}>
                              {companion.name}
                            </span>
                            <span style={{ fontSize: "11px", color: T.muted(isDark) }}>
                              {companion.gender} · {companion.age} years old
                            </span>
                          </div>

                          {/* Attributes details */}
                          <div className="flex flex-col gap-2" style={{ fontSize: "12px", borderTop: `1px solid ${T.separator(isDark)}`, paddingTop: "12px" }}>
                            <div className="flex justify-between mt-1">
                              <span style={{ color: T.muted(isDark) }}>Relationship style:</span>
                              <span className="font-medium">{companion.relationship_style}</span>
                            </div>
                            <div className="flex justify-between">
                              <span style={{ color: T.muted(isDark) }}>Safety Boundaries:</span>
                              <span className="font-medium">{companion.nsfw ? "Adult / NSFW" : "PG-13"}</span>
                            </div>
                            <div className="flex flex-col gap-1 mt-1">
                              <span style={{ color: T.muted(isDark) }}>Personality / Backstory:</span>
                              <span className="line-clamp-2 text-xs italic" style={{ color: T.dim(isDark), lineHeight: 1.4 }}>
                                "{companion.custom_description}"
                              </span>
                            </div>

                            {companion.nsfw && companion.physical_traits && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {Object.entries(companion.physical_traits)
                                  .filter(([_, val]) => val && val !== "natural" && val !== "average" && val !== "slim")
                                  .map(([key, val]) => (
                                    <span
                                      key={key}
                                      className="px-2 py-0.5 rounded text-[10px]"
                                      style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.035)", border: `1px solid ${T.cardBorder(isDark)}` }}
                                    >
                                      {val} {key.replace("_size", "").replace("color", "")}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>

                          {/* Action panel */}
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDistillCompanion(companion);
                              }}
                              className="px-2 py-1 rounded-lg border transition-colors flex items-center gap-1.5 hover:bg-purple-500/10 text-purple-400 border-purple-500/20"
                              title="Distill Style from Chat Logs"
                            >
                              <Sparkles size={12} />
                              <span className="text-[11px] font-medium">Distill Style</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => startEdit(companion, e)}
                              className="p-1.5 rounded-lg border transition-colors hover:bg-white/[0.04]"
                              style={{ borderColor: T.cardBorder(isDark), color: T.muted(isDark) }}
                              title="Edit Companion details"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(companion.id, e)}
                              className="p-1.5 rounded-lg border border-red-500/10 text-red-500/70 hover:bg-red-500/5 hover:text-red-500 transition-colors"
                              title="Delete Companion"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Edit companion form */
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-5 max-w-2xl mx-auto">
              <h3 style={{ fontSize: "16px", fontWeight: 500 }}>Edit Companion Profile</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Companion Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg text-sm transition-all outline-none"
                    style={{
                      background: isDark ? "#121212" : "#F3F3F2",
                      border: `1px solid ${T.cardBorder(isDark)}`,
                      color: T.text(isDark),
                    }}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Addresses you as (User Name)
                  </label>
                  <input
                    type="text"
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg text-sm transition-all outline-none"
                    style={{
                      background: isDark ? "#121212" : "#F3F3F2",
                      border: `1px solid ${T.cardBorder(isDark)}`,
                      color: T.text(isDark),
                    }}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Gender
                  </label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg text-sm transition-all outline-none"
                    style={{
                      background: isDark ? "#121212" : "#F3F3F2",
                      border: `1px solid ${T.cardBorder(isDark)}`,
                      color: T.text(isDark),
                    }}
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="non-binary">Non-Binary</option>
                    <option value="androgyne">Androgyne</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Age
                  </label>
                  <input
                    type="number"
                    value={editAge}
                    min={18}
                    onChange={(e) => setEditAge(parseInt(e.target.value) || 18)}
                    className="w-full px-4 py-2 rounded-lg text-sm transition-all outline-none"
                    style={{
                      background: isDark ? "#121212" : "#F3F3F2",
                      border: `1px solid ${T.cardBorder(isDark)}`,
                      color: T.text(isDark),
                    }}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Relationship Dynamic
                  </label>
                  <input
                    type="text"
                    value={editStyle}
                    onChange={(e) => setEditStyle(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg text-sm transition-all outline-none"
                    style={{
                      background: isDark ? "#121212" : "#F3F3F2",
                      border: `1px solid ${T.cardBorder(isDark)}`,
                      color: T.text(isDark),
                    }}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Safety Settings
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={handleEditNsfwToggle}
                      className="w-[42px] h-[22px] rounded-full p-0.5 transition-colors relative outline-none shrink-0"
                      style={{ background: editNsfw ? T.accent : isDark ? "#3F3F46" : "#E4E4E7" }}
                    >
                      <motion.div
                        layout
                        className="w-[18px] h-[18px] rounded-full bg-white shadow-md"
                        animate={{ x: editNsfw ? 20 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                    <span style={{ fontSize: "13px" }}>{editNsfw ? "Uncensored Adult Content" : "PG-13 Content Guardrails"}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Personality & Backstory
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg text-sm transition-all outline-none min-h-[80px] resize-none"
                  style={{
                    background: isDark ? "#121212" : "#F3F3F2",
                    border: `1px solid ${T.cardBorder(isDark)}`,
                    color: T.text(isDark),
                  }}
                  required
                />
              </div>

              {editNsfw && (
                <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.015)", border: `1px solid ${T.cardBorder(isDark)}` }}>
                  <span style={{ fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted(isDark) }}>
                    Physical attributes details
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px]" style={{ color: T.muted(isDark) }}>Bust Size</span>
                      <input
                        type="text"
                        value={editBust}
                        onChange={(e) => setEditBust(e.target.value)}
                        className="px-3 py-1.5 rounded text-xs outline-none"
                        style={{ background: isDark ? "#1A1A1A" : "#FFFFFF", border: `1px solid ${T.cardBorder(isDark)}`, color: T.text(isDark) }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px]" style={{ color: T.muted(isDark) }}>Waist Size</span>
                      <input
                        type="text"
                        value={editWaist}
                        onChange={(e) => setEditWaist(e.target.value)}
                        className="px-3 py-1.5 rounded text-xs outline-none"
                        style={{ background: isDark ? "#1A1A1A" : "#FFFFFF", border: `1px solid ${T.cardBorder(isDark)}`, color: T.text(isDark) }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px]" style={{ color: T.muted(isDark) }}>Hips Size</span>
                      <input
                        type="text"
                        value={editHips}
                        onChange={(e) => setEditHips(e.target.value)}
                        className="px-3 py-1.5 rounded text-xs outline-none"
                        style={{ background: isDark ? "#1A1A1A" : "#FFFFFF", border: `1px solid ${T.cardBorder(isDark)}`, color: T.text(isDark) }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px]" style={{ color: T.muted(isDark) }}>Skin Tone</span>
                      <input
                        type="text"
                        value={editSkin}
                        onChange={(e) => setEditSkin(e.target.value)}
                        className="px-3 py-1.5 rounded text-xs outline-none"
                        style={{ background: isDark ? "#1A1A1A" : "#FFFFFF", border: `1px solid ${T.cardBorder(isDark)}`, color: T.text(isDark) }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px]" style={{ color: T.muted(isDark) }}>Hair Color</span>
                      <input
                        type="text"
                        value={editHair}
                        onChange={(e) => setEditHair(e.target.value)}
                        className="px-3 py-1.5 rounded text-xs outline-none"
                        style={{ background: isDark ? "#1A1A1A" : "#FFFFFF", border: `1px solid ${T.cardBorder(isDark)}`, color: T.text(isDark) }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px]" style={{ color: T.muted(isDark) }}>Eye Color</span>
                      <input
                        type="text"
                        value={editEye}
                        onChange={(e) => setEditEye(e.target.value)}
                        className="px-3 py-1.5 rounded text-xs outline-none"
                        style={{ background: isDark ? "#1A1A1A" : "#FFFFFF", border: `1px solid ${T.cardBorder(isDark)}`, color: T.text(isDark) }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="regenCheckbox"
                  checked={regeneratePrompt}
                  onChange={(e) => setRegeneratePrompt(e.target.checked)}
                  className="rounded"
                  style={{ accentColor: T.accent }}
                />
                <label htmlFor="regenCheckbox" style={{ fontSize: "12.5px", cursor: "pointer" }}>
                  Regenerate system prompt using local LLM synthesis (recommended)
                </label>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-4 mt-2" style={{ borderTop: `1px solid ${T.separator(isDark)}` }}>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="px-4 py-2 rounded-lg text-sm border"
                  style={{ borderColor: T.cardBorder(isDark), color: T.muted(isDark) }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow-sm"
                  style={{ background: T.accent, color: "#060606" }}
                >
                  {loading && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>

    <AgeGateModal
      open={gateOpen}
      isDark={isDark}
      onConfirm={handleConfirm}
      onDismiss={handleDismiss}
    />

    {distillCompanion && (
      <PersonaDistillationWizard
        isDark={isDark}
        sessionUrl={sessionUrl}
        personaId={distillCompanion.id}
        personaName={distillCompanion.name}
        onClose={() => setDistillCompanion(null)}
      />
    )}
  </>
  );
}
