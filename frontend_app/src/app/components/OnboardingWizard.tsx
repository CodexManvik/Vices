/**
 * OnboardingWizard.tsx
 *
 * First-time setup wizard for VICES AI.
 * 1. Welcomes the user & asks for preferred name.
 * 2. Explains local system permissions (files, terminal commands, web search).
 * 3. Asks if user wants uncensored/adult mode (requires 18+ age verification).
 * 4. Lets user pick starting companion:
 *    - Rosia (built-in) [Visible ONLY if 18+ verified]
 *    - Build Custom Companion
 *    - Plain Assistant (Skip for later / Default)
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  User,
  Heart,
  ShieldAlert,
  Terminal,
  Folder,
  Globe,
  Check,
  ArrowRight,
  ArrowLeft,
  Flame,
  Bot,
  Plus,
  Loader2,
} from "lucide-react";

interface OnboardingWizardProps {
  isDark: boolean;
  sessionUrl: string | null;
  onComplete: (activePersonaId?: string) => void;
  onTriggerCustomBuild: () => void;
}

export function OnboardingWizard({
  isDark,
  sessionUrl,
  onComplete,
  onTriggerCustomBuild,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isActivating, setIsActivating] = useState(false);
  const [activationMessage, setActivationMessage] = useState("Loading persona profile & warming up AI engine...");

  // Step 1 State: User Name
  const [userName, setUserName] = useState(
    localStorage.getItem("vices_user_name") || ""
  );

  // Step 2 State: Uncensored Mode & Age Gate
  const [enableAdultMode, setEnableAdultMode] = useState(
    localStorage.getItem("vices_age_verified") === "true"
  );
  const [ageConfirmed, setAgeConfirmed] = useState(
    localStorage.getItem("vices_age_verified") === "true"
  );

  // Step 3 State: Companion choice (Rosia default for everyone)
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("rosia_builtin");

  // Colors
  const bg = isDark ? "#080808" : "#FAFAF9";
  const card = isDark ? "#111111" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const text = isDark ? "#E2E8F0" : "#1C1917";
  const muted = isDark ? "#71717A" : "#8E8781";
  const accent = "#38BDF8";

  const handleStep1Next = () => {
    const trimmed = userName.trim() || "User";
    localStorage.setItem("vices_user_name", trimmed);
    setStep(2);
  };

  const handleStep2Next = () => {
    if (enableAdultMode && !ageConfirmed) {
      return;
    }

    if (enableAdultMode && ageConfirmed) {
      localStorage.setItem("vices_age_verified", "true");
    } else {
      localStorage.setItem("vices_age_verified", "false");
    }

    setStep(3);
  };

  const handleFinalize = async (choiceId: string) => {
    if (choiceId === "custom_build") {
      localStorage.setItem("vices_onboarding_done", "true");
      onTriggerCustomBuild();
      return;
    }

    setIsActivating(true);
    setActivationMessage("Loading persona profile & Turbovec memory indices...");

    if (sessionUrl) {
      try {
        const fetchUrl = sessionUrl.replace(/\/+$/, "");
        const fd = new FormData();
        fd.append("persona_id", choiceId);
        await fetch(`${fetchUrl}/personas/activate`, {
          method: "POST",
          body: fd,
        });
      } catch (e) {
        console.error("Failed to set active persona on backend:", e);
      }
    }

    setActivationMessage("Warming up AI engine context...");
    await new Promise((resolve) => setTimeout(resolve, 400));

    localStorage.setItem("vices_onboarding_done", "true");
    setIsActivating(false);
    onComplete(choiceId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto select-none"
      style={{
        background: isDark ? "rgba(4, 4, 4, 0.92)" : "rgba(240, 240, 240, 0.88)",
        backdropFilter: "blur(12px)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-xl rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: card,
          border: `1px solid ${cardBorder}`,
          boxShadow: isDark
            ? "0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.05)"
            : "0 16px 40px rgba(0,0,0,0.08)",
          color: text,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {isActivating ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-4 my-8">
            <Loader2 size={36} className="animate-spin text-sky-400" />
            <h3 style={{ fontSize: "17px", fontWeight: 600 }}>Starting Your Session</h3>
            <p style={{ fontSize: "13px", color: muted, maxWidth: "340px", lineHeight: 1.5 }}>
              {activationMessage}
            </p>
          </div>
        ) : (
          <>
        {/* Step Indicator Header */}
        <div
          className="px-8 pt-6 pb-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${cardBorder}` }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: accent }} />
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "22px",
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              Welcome to VICES AI
            </h1>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: muted }}>
            <span>Step {step} of 3</span>
            <div className="flex gap-1 ml-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{
                    background: i === step ? accent : isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-8 flex-1">
          <AnimatePresence mode="wait">
            {/* STEP 1: Welcome & Name & Permissions */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <h2 style={{ fontSize: "17px", fontWeight: 600 }} className="mb-1">
                    First, let's get acquainted.
                  </h2>
                  <p style={{ fontSize: "13px", color: muted, lineHeight: 1.5 }}>
                    VICES runs decentralized on your local machine. Tell us what your AI assistant should call you.
                  </p>
                </div>

                {/* Name Input */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: muted }}>
                    Your Name / Preferred Nickname
                  </label>
                  <div className="relative flex items-center">
                    <User size={16} className="absolute left-3.5" style={{ color: muted }} />
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="e.g. Manvik, Alex, Captain..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                        border: `1px solid ${cardBorder}`,
                        color: text,
                      }}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Permissions Breakdown */}
                <div
                  className="rounded-xl p-4 flex flex-col gap-3"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.015)",
                    border: `1px solid ${cardBorder}`,
                  }}
                >
                  <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: muted }}>
                    System Access & Tool Permissions
                  </span>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div className="flex items-center gap-2.5">
                      <Folder size={14} style={{ color: accent }} />
                      <span><strong>Filesystem:</strong> Safe read/write in workspace with rollback logs</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Terminal size={14} style={{ color: accent }} />
                      <span><strong>Shell Commands:</strong> Execute local system tasks upon request</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Globe size={14} style={{ color: accent }} />
                      <span><strong>Web Integration:</strong> Fetch real-time web context & search results</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStep1Next}
                  className="w-full py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md mt-2"
                  style={{ background: accent, color: "#060606" }}
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              </motion.div>
            )}

            {/* STEP 2: Adult / Uncensored Option & Age Gate */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <h2 style={{ fontSize: "17px", fontWeight: 600 }} className="mb-1">
                    Content Safety & Uncensored Dynamic
                  </h2>
                  <p style={{ fontSize: "13px", color: muted, lineHeight: 1.5 }}>
                    VICES supports both filtered standard mode and unrestricted uncensored dynamic models.
                  </p>
                </div>

                {/* Mode Selector Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => {
                      setEnableAdultMode(false);
                      setAgeConfirmed(false);
                    }}
                    className="p-4 rounded-xl cursor-pointer border transition-all flex flex-col gap-2"
                    style={{
                      background: !enableAdultMode ? (isDark ? "rgba(56,189,248,0.06)" : "rgba(56,189,248,0.08)") : "transparent",
                      borderColor: !enableAdultMode ? accent : cardBorder,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <Bot size={18} style={{ color: !enableAdultMode ? accent : muted }} />
                      {!enableAdultMode && <Check size={14} style={{ color: accent }} />}
                    </div>
                    <span style={{ fontSize: "13.5px", fontWeight: 600 }}>Standard Mode</span>
                    <span style={{ fontSize: "11px", color: muted, lineHeight: 1.4 }}>
                      Filtered, family-friendly interactions. Ideal for coding and everyday tasks.
                    </span>
                  </div>

                  <div
                    onClick={() => setEnableAdultMode(true)}
                    className="p-4 rounded-xl cursor-pointer border transition-all flex flex-col gap-2"
                    style={{
                      background: enableAdultMode ? "rgba(245,158,11,0.08)" : "transparent",
                      borderColor: enableAdultMode ? "#F59E0B" : cardBorder,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <Flame size={18} style={{ color: enableAdultMode ? "#F59E0B" : muted }} />
                      {enableAdultMode && <Check size={14} style={{ color: "#F59E0B" }} />}
                    </div>
                    <span style={{ fontSize: "13.5px", fontWeight: 600 }}>Uncensored Model (18+)</span>
                    <span style={{ fontSize: "11px", color: muted, lineHeight: 1.4 }}>
                      Unrestricted AI model download option. Requires 18+ age verification.
                    </span>
                  </div>
                </div>

                {/* If Adult mode selected, require Age Verification Check */}
                {enableAdultMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-4 rounded-xl border flex flex-col gap-3"
                    style={{
                      background: "rgba(245,158,11,0.04)",
                      borderColor: "rgba(245,158,11,0.2)",
                    }}
                  >
                    <div className="flex items-center gap-2 text-amber-500 text-xs font-semibold">
                      <ShieldAlert size={16} />
                      <span>Age Verification Confirmation Required</span>
                    </div>
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                      <input
                        type="checkbox"
                        checked={ageConfirmed}
                        onChange={(e) => setAgeConfirmed(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span style={{ color: text, lineHeight: 1.4 }}>
                        I explicitly confirm that I am <strong>18 years of age or older</strong> and consent to downloading and using uncensored AI models.
                      </span>
                    </label>
                  </motion.div>
                )}

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border"
                    style={{ borderColor: cardBorder, color: muted }}
                  >
                    <ArrowLeft size={14} />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStep2Next}
                    disabled={enableAdultMode && !ageConfirmed}
                    className="flex-1 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
                    style={{
                      background: enableAdultMode && !ageConfirmed ? (isDark ? "#262626" : "#E5E7EB") : accent,
                      color: enableAdultMode && !ageConfirmed ? muted : "#060606",
                      cursor: enableAdultMode && !ageConfirmed ? "not-allowed" : "pointer",
                    }}
                  >
                    <span>Continue</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Companion Persona Selection */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <h2 style={{ fontSize: "17px", fontWeight: 600 }} className="mb-1">
                    Choose Your Starting Companion
                  </h2>
                  <p style={{ fontSize: "13px", color: muted, lineHeight: 1.5 }}>
                    Select how VICES will converse with you. You can change or distill companion personas anytime later.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {/* Rosia Card */}
                  <div
                    onClick={() => setSelectedPersonaId("rosia_builtin")}
                    className="p-4 rounded-xl cursor-pointer border transition-all flex items-start justify-between"
                    style={{
                      background: selectedPersonaId === "rosia_builtin" ? (isDark ? "rgba(56,189,248,0.06)" : "rgba(56,189,248,0.08)") : "transparent",
                      borderColor: selectedPersonaId === "rosia_builtin" ? accent : cardBorder,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: "rgba(56,189,248,0.1)", color: accent }}
                      >
                        <Heart size={18} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: "14px", fontWeight: 600 }}>Rosia</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            Built-in Companion
                          </span>
                        </div>
                        <span style={{ fontSize: "11.5px", color: muted, lineHeight: 1.4 }}>
                          Hardcoded core persona. Warm, witty, emotionally present, and engaging companion.
                        </span>
                      </div>
                    </div>
                    {selectedPersonaId === "rosia_builtin" && <Check size={16} style={{ color: accent }} className="mt-1" />}
                  </div>

                  {/* Plain Assistant Card */}
                  <div
                    onClick={() => setSelectedPersonaId("plain_assistant")}
                    className="p-4 rounded-xl cursor-pointer border transition-all flex items-start justify-between"
                    style={{
                      background: selectedPersonaId === "plain_assistant" ? (isDark ? "rgba(56,189,248,0.06)" : "rgba(56,189,248,0.08)") : "transparent",
                      borderColor: selectedPersonaId === "plain_assistant" ? accent : cardBorder,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: muted }}
                      >
                        <Bot size={18} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: "14px", fontWeight: 600 }}>Plain AI Assistant</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            Standard / Neutral
                          </span>
                        </div>
                        <span style={{ fontSize: "11.5px", color: muted, lineHeight: 1.4 }}>
                          Direct, neutral AI coding & task assistant without companion emotional dynamics.
                        </span>
                      </div>
                    </div>
                    {selectedPersonaId === "plain_assistant" && <Check size={16} style={{ color: accent }} className="mt-1" />}
                  </div>

                  {/* Build Custom Persona Card */}
                  <div
                    onClick={() => setSelectedPersonaId("custom_build")}
                    className="p-4 rounded-xl cursor-pointer border transition-all flex items-start justify-between hover:bg-white/[0.02]"
                    style={{
                      background: selectedPersonaId === "custom_build" ? (isDark ? "rgba(56,189,248,0.06)" : "rgba(56,189,248,0.08)") : "transparent",
                      borderColor: selectedPersonaId === "custom_build" ? accent : cardBorder,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: "rgba(168,85,247,0.1)", color: "#A855F7" }}
                      >
                        <Plus size={18} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: "14px", fontWeight: 600 }}>Build Custom Companion</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Interactive Wizard
                          </span>
                        </div>
                        <span style={{ fontSize: "11.5px", color: muted, lineHeight: 1.4 }}>
                          Synthesize a custom persona with specific traits, pronouns, and relationship style.
                        </span>
                      </div>
                    </div>
                    {selectedPersonaId === "custom_build" && <Check size={16} style={{ color: accent }} className="mt-1" />}
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border"
                    style={{ borderColor: cardBorder, color: muted }}
                  >
                    <ArrowLeft size={14} />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFinalize(selectedPersonaId)}
                    className="flex-1 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
                    style={{ background: accent, color: "#060606" }}
                  >
                    <span>Launch VICES</span>
                    <Sparkles size={14} />
                  </button>
                </div>
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      </>
    )}
  </motion.div>
</div>
  );
}
