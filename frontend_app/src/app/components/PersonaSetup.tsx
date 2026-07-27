/**
 * PersonaSetup.tsx
 *
 * Interactive step-by-step wizard for configuring a new VICES companion.
 * Integrates with the backend's /personas/setup endpoint to run LLM system prompt synthesis.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  User,
  Heart,
  ArrowLeft,
  ArrowRight,
  Shield,
  ShieldAlert,
  Dna,
  Sliders,
  Scale,
  Maximize2,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useAgeGate, AgeGateModal } from "./AgeGateModal";

interface PhysicalTraits {
  skin_tone?: string;
  hair_color?: string;
  eye_color?: string;
}

export interface PersonaSetupProps {
  isDark: boolean;
  sessionUrl: string | null;
  onComplete: () => void;
  onCancel?: () => void;
  allowCancel?: boolean;
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

export function PersonaSetup({
  isDark,
  sessionUrl,
  onComplete,
  onCancel,
  allowCancel = false,
}: PersonaSetupProps) {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStatusText, setGenStatusText] = useState("Initializing neural channels...");
  const [error, setError] = useState<string | null>(null);

  // Questionnaire form states
  const [name, setName] = useState("Rosia");
  const [gender, setGender] = useState("female");
  const [age, setAge] = useState(18);
  const [relationshipStyle, setRelationshipStyle] = useState("Companion");
  const [customStyleText, setCustomStyleText] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [userName, setUserName] = useState("User");

  // Physical traits states
  const [skinTone, setSkinTone] = useState("fair");
  const [hairColor, setHairColor] = useState("brunette");
  const [eyeColor, setEyeColor] = useState("brown");

  const activeRelStyle = relationshipStyle === "Custom" ? customStyleText : relationshipStyle;

  const validateStep = () => {
    setError(null);
    if (step === 2) {
      if (!name.trim()) {
        setError("Companion name is required.");
        return false;
      }
      if (!userName.trim()) {
        setError("User name is required.");
        return false;
      }
      if (age < 18) {
        setError("Companion must be 18 years or older.");
        return false;
      }
    } else if (step === 3) {
      if (relationshipStyle === "Custom" && !customStyleText.trim()) {
        setError("Please define your custom relationship style.");
        return false;
      }
      if (!customDescription.trim()) {
        setError("Please add a brief description or backstory.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      if (step === 4) {
        handleSubmit();
      } else {
        setStep((s) => s + 1);
      }
    }
  };

  const handlePrev = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    setIsGenerating(true);
    setError(null);
    setGenProgress(10);
    setGenStatusText("Loading local Gemma-4 LLM parameters...");

    // Simulate progress updates during LLM generation
    const timer = setInterval(() => {
      setGenProgress((p) => {
        if (p >= 90) {
          clearInterval(timer);
          return 90;
        }
        const next = p + Math.floor(Math.random() * 15) + 5;
        if (next >= 30 && next < 60) {
          setGenStatusText("Structuring cognitive persona parameters...");
        } else if (next >= 60 && next < 85) {
          setGenStatusText("Synthesizing system prompt matrices...");
        } else if (next >= 85) {
          setGenStatusText("Finalizing prompt injection configuration...");
        }
        return next;
      });
    }, 1200);

    try {
      const baseUrl = (sessionUrl || "http://localhost:8000").replace(/\/+$/, "");
      const physical_traits: PhysicalTraits = {
        skin_tone: skinTone,
        hair_color: hairColor,
        eye_color: eyeColor,
      };

      const payload = {
        name,
        gender,
        age,
        relationship_style: activeRelStyle,
        custom_description: customDescription,
        user_name: userName,
        uncensored: false,
        physical_traits,
      };

      const res = await fetch(`${baseUrl}/personas/setup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Age-Verified": localStorage.getItem("vices_age_verified") || "false",
        },
        body: JSON.stringify(payload),
      });

      clearInterval(timer);

      if (res.ok) {
        setGenProgress(100);
        setGenStatusText("Persona initialized successfully!");
        localStorage.setItem("vices_persona_setup_done", "1");
        setTimeout(() => {
          setIsGenerating(false);
          onComplete();
        }, 1000);
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || "Setup API request failed");
      }
    } catch (err: any) {
      clearInterval(timer);
      setIsGenerating(false);
      setError(err?.message || "Failed to setup persona. Make sure the backend is active.");
      setStep(4); // fallback to form
    }
  };

  return (
    <>
      <div
      className="relative min-h-screen w-full flex items-center justify-center overflow-y-auto px-6 py-12"
      style={{
        background: T.bg(isDark),
        color: T.text(isDark),
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Background radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at 50% 40%, rgba(56,189,248,0.03) 0%, transparent 65%)"
            : "radial-gradient(ellipse at 50% 40%, rgba(56,189,248,0.05) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 w-full max-w-xl flex flex-col gap-6">
        {isGenerating ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-6"
            style={{
              background: T.card(isDark),
              border: `1px solid ${T.cardBorder(isDark)}`,
              boxShadow: isDark ? "0 24px 64px rgba(0,0,0,0.6)" : "0 12px 32px rgba(0,0,0,0.05)",
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
            >
              <Dna size={42} style={{ color: T.accent }} />
            </motion.div>
            
            <div className="flex flex-col gap-2">
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "26px",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                }}
              >
                Synthesizing VICES Companion Core
              </h2>
              <p style={{ fontSize: "13px", color: T.muted(isDark) }}>
                {genStatusText}
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-full flex flex-col gap-2 mt-4">
              <div
                className="h-[3px] w-full rounded-full overflow-hidden"
                style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${genProgress}%`,
                    background: `linear-gradient(90deg, rgba(56,189,248,0.4), ${T.accent})`,
                    boxShadow: `0 0 8px ${T.accent}`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px]" style={{ color: T.muted(isDark) }}>
                <span>Uncensored local Gemma-4 setup</span>
                <span>{genProgress}%</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <div
            className="rounded-2xl p-8 flex flex-col gap-6"
            style={{
              background: T.card(isDark),
              border: `1px solid ${T.cardBorder(isDark)}`,
              boxShadow: isDark ? "0 24px 64px rgba(0,0,0,0.6)" : "0 12px 32px rgba(0,0,0,0.05)",
            }}
          >
            {/* Header progress steps */}
            <div className="flex items-center justify-between pb-4" style={{ borderBottom: `1px solid ${T.separator(isDark)}` }}>
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: T.accent }} />
                <span
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "20px",
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                  }}
                >
                  VICES Companion Customizer
                </span>
              </div>
              <span style={{ fontSize: "11px", color: T.muted(isDark), letterSpacing: "0.1em" }}>
                STEP {step} OF 4
              </span>
            </div>

            {error && (
              <div
                className="p-3.5 rounded-lg flex items-start gap-3"
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#F87171",
                  fontSize: "12.5px",
                }}
              >
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Steps screens */}
            <div className="min-h-[280px]">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex flex-col gap-4"
                  >
                    <h3 style={{ fontSize: "16px", fontWeight: 500 }}>Create Your Perfect AI Companion</h3>
                    <p style={{ fontSize: "13.5px", color: T.muted(isDark), lineHeight: 1.6 }}>
                      Welcome to the VICES Core customizer. Our downloaded local model will dynamically design your companion's system prompts.
                    </p>
                    <p style={{ fontSize: "13.5px", color: T.muted(isDark), lineHeight: 1.6 }}>
                      In the following steps, you will configure their name, relationship dynamics, custom backstory, and safety options.
                    </p>
                    <div
                      className="p-4 rounded-xl mt-3 flex items-start gap-3"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                        border: `1px solid ${T.cardBorder(isDark)}`,
                      }}
                    >
                      <Shield size={16} className="shrink-0 mt-0.5" style={{ color: T.accent }} />
                      <div className="flex flex-col gap-1">
                        <span style={{ fontSize: "12px", fontWeight: 500 }}>Uncensored Privacy</span>
                        <span style={{ fontSize: "11px", color: T.muted(isDark), lineHeight: 1.4 }}>
                          Because VICES runs completely on your local hardware, your companionship configuration and prompts are strictly private and offline.
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex flex-col gap-4"
                  >
                    <h3 style={{ fontSize: "16px", fontWeight: 500 }}>Basic Identity Details</h3>
                    
                    <div className="flex flex-col gap-1.5">
                      <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Companion Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none"
                        style={{
                          background: isDark ? "#121212" : "#F3F3F2",
                          border: `1px solid ${T.cardBorder(isDark)}`,
                          color: T.text(isDark),
                        }}
                        placeholder="e.g. Rosia"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Companion Gender
                        </label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none"
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
                          Companion Age
                        </label>
                        <input
                          type="number"
                          value={age}
                          min={18}
                          onChange={(e) => setAge(parseInt(e.target.value) || 18)}
                          className="w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none"
                          style={{
                            background: isDark ? "#121212" : "#F3F3F2",
                            border: `1px solid ${T.cardBorder(isDark)}`,
                            color: T.text(isDark),
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        How should they address you? (User Name)
                      </label>
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none"
                        style={{
                          background: isDark ? "#121212" : "#F3F3F2",
                          border: `1px solid ${T.cardBorder(isDark)}`,
                          color: T.text(isDark),
                        }}
                        placeholder="e.g. Master, Honey, or your name"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex flex-col gap-4"
                  >
                    <h3 style={{ fontSize: "16px", fontWeight: 500 }}>Personality & Relationship Style</h3>

                    <div className="flex flex-col gap-1.5">
                      <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Relationship Dynamic
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {["Intimate", "Playful", "Friendly", "Custom"].map((style) => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => setRelationshipStyle(style)}
                            className="px-4 py-2.5 rounded-lg text-sm border font-medium text-left transition-all"
                            style={{
                              background: relationshipStyle === style ? T.accentDim : "transparent",
                              borderColor: relationshipStyle === style ? T.accent : T.cardBorder(isDark),
                              color: relationshipStyle === style ? T.accent : T.text(isDark),
                            }}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    {relationshipStyle === "Custom" && (
                      <div className="flex flex-col gap-1.5">
                        <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Custom Dynamic Description
                        </label>
                        <input
                          type="text"
                          value={customStyleText}
                          onChange={(e) => setCustomStyleText(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none"
                          style={{
                            background: isDark ? "#121212" : "#F3F3F2",
                            border: `1px solid ${T.cardBorder(isDark)}`,
                            color: T.text(isDark),
                          }}
                          placeholder="e.g. Childhood best friends who secretly like each other"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Description, Backstory & Traits
                      </label>
                      <textarea
                        value={customDescription}
                        onChange={(e) => setCustomDescription(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none min-h-[100px] resize-none"
                        style={{
                          background: isDark ? "#121212" : "#F3F3F2",
                          border: `1px solid ${T.cardBorder(isDark)}`,
                          color: T.text(isDark),
                        }}
                        placeholder="e.g. A flirty, highly intelligent software engineer who is sarcastic, teasing, loves synthwave music, and gets jealous easily."
                      />
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex flex-col gap-4"
                  >
                    <h3 style={{ fontSize: "16px", fontWeight: 500 }}>Physical Attributes (Optional)</h3>
                    <p style={{ fontSize: "12px", color: T.muted(isDark) }}>
                      Configure aesthetic physical details used when synthesizing prompts and selfies.
                    </p>

                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="flex flex-col gap-1.5">
                        <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Skin Tone
                        </label>
                        <input
                          type="text"
                          value={skinTone}
                          onChange={(e) => setSkinTone(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none"
                          style={{
                            background: isDark ? "#121212" : "#F3F3F2",
                            border: `1px solid ${T.cardBorder(isDark)}`,
                            color: T.text(isDark),
                          }}
                          placeholder="e.g. fair, tanned, olive"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Hair Color / Style
                        </label>
                        <input
                          type="text"
                          value={hairColor}
                          onChange={(e) => setHairColor(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none"
                          style={{
                            background: isDark ? "#121212" : "#F3F3F2",
                            border: `1px solid ${T.cardBorder(isDark)}`,
                            color: T.text(isDark),
                          }}
                          placeholder="e.g. long blonde, brunette"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label style={{ fontSize: "11px", color: T.muted(isDark), textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Eye Color
                        </label>
                        <input
                          type="text"
                          value={eyeColor}
                          onChange={(e) => setEyeColor(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none"
                          style={{
                            background: isDark ? "#121212" : "#F3F3F2",
                            border: `1px solid ${T.cardBorder(isDark)}`,
                            color: T.text(isDark),
                          }}
                          placeholder="e.g. blue, hazel, brown"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-6 mt-2" style={{ borderTop: `1px solid ${T.separator(isDark)}` }}>
              <div>
                {allowCancel && onCancel ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 rounded-lg text-sm transition-colors"
                    style={{ color: T.muted(isDark) }}
                  >
                    Cancel
                  </button>
                ) : (
                  step > 1 && (
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors"
                      style={{ color: T.muted(isDark) }}
                    >
                      <ArrowLeft size={14} />
                      <span>Back</span>
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                style={{
                  background: T.accent,
                  color: "#060606",
                }}
              >
                <span>{step === 4 ? "Generate Companion" : "Continue"}</span>
                {step === 4 ? (
                  <Sparkles size={14} />
                ) : (
                  <ArrowRight size={14} />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </>
  );
}
