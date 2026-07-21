/**
 * AgeGateModal.tsx
 *
 * A modal overlay that requests the user to confirm they are 18+ before
 * enabling NSFW/uncensored features. Verification state is persisted in
 * localStorage so it only needs to happen once per device.
 *
 * Usage:
 *   const { isAdultVerified, requestVerification, AgeGateModal } = useAgeGate();
 *
 *   // In JSX:
 *   <AgeGateModal />
 *
 *   // When NSFW toggle is clicked:
 *   if (!isAdultVerified) {
 *     requestVerification(() => setNsfw(true));
 *   } else {
 *     setNsfw(true);
 *   }
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldAlert, X } from "lucide-react";

const AGE_VERIFIED_KEY = "vices_age_verified";

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useAgeGate() {
  const [gateOpen, setGateOpen] = useState(false);
  const pendingCallback = useRef<(() => void) | null>(null);

  const isAdultVerified =
    typeof window !== "undefined" &&
    localStorage.getItem(AGE_VERIFIED_KEY) === "true";

  /**
   * Call this when the user tries to enable an NSFW feature.
   * If already verified, runs the callback immediately.
   * If not verified, opens the modal. On success, sets verification
   * in localStorage and runs the callback.
   */
  const requestVerification = useCallback(
    (onVerified: () => void) => {
      if (localStorage.getItem(AGE_VERIFIED_KEY) === "true") {
        onVerified();
        return;
      }
      pendingCallback.current = onVerified;
      setGateOpen(true);
    },
    []
  );

  const handleConfirm = useCallback(() => {
    localStorage.setItem(AGE_VERIFIED_KEY, "true");
    setGateOpen(false);
    if (pendingCallback.current) {
      pendingCallback.current();
      pendingCallback.current = null;
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setGateOpen(false);
    pendingCallback.current = null;
  }, []);

  return {
    isAdultVerified,
    requestVerification,
    gateOpen,
    handleConfirm,
    handleDismiss,
  };
}

// ─────────────────────────────────────────────────────────────
// Modal component
// ─────────────────────────────────────────────────────────────

interface AgeGateModalProps {
  open: boolean;
  isDark: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function AgeGateModal({
  open,
  isDark,
  onConfirm,
  onDismiss,
}: AgeGateModalProps) {
  const [checked, setChecked] = useState(false);

  // Reset checkbox state each time the modal opens
  const handleOpen = () => setChecked(false);

  const bg = isDark ? "#0A0A0A" : "#FAFAF9";
  const card = isDark ? "#111111" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const text = isDark ? "#E2E8F0" : "#1C1917";
  const muted = isDark ? "#71717A" : "#8E8781";
  const accent = "#F59E0B"; // amber — deliberate choice: warning, not primary blue

  return (
    <AnimatePresence onExitComplete={handleOpen}>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="agegate-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onDismiss}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(6px)",
              zIndex: 9998,
            }}
          />

          {/* Modal */}
          <motion.div
            key="agegate-modal"
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 16 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(460px, 92vw)",
              background: card,
              border: `1px solid ${cardBorder}`,
              borderRadius: "20px",
              boxShadow: isDark
                ? "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(245,158,11,0.08)"
                : "0 16px 48px rgba(0,0,0,0.12)",
              zIndex: 9999,
              overflow: "hidden",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {/* Amber accent bar */}
            <div
              style={{
                height: "3px",
                background: `linear-gradient(90deg, ${accent}, #FBBF24)`,
                width: "100%",
              }}
            />

            <div style={{ padding: "28px 28px 24px" }}>
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: "20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "rgba(245,158,11,0.12)",
                      border: "1px solid rgba(245,158,11,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <ShieldAlert size={20} color={accent} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: text,
                        letterSpacing: "-0.01em",
                        lineHeight: 1.3,
                      }}
                    >
                      Age Verification Required
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: muted,
                        marginTop: "2px",
                      }}
                    >
                      Adult content is locked by default
                    </div>
                  </div>
                </div>

                <button
                  onClick={onDismiss}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    color: muted,
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <p
                style={{
                  fontSize: "13.5px",
                  color: muted,
                  lineHeight: 1.65,
                  marginBottom: "20px",
                }}
              >
                Enabling this feature downloads the uncensored Gemma-4 model and
                unlocks adult/explicit roleplay content. This content is intended
                strictly for adults.
              </p>

              {/* Confirmation checkbox */}
              <label
                htmlFor="age-confirm-checkbox"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: checked
                    ? "rgba(245,158,11,0.07)"
                    : isDark
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,0,0,0.02)",
                  border: `1px solid ${
                    checked ? "rgba(245,158,11,0.2)" : cardBorder
                  }`,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  marginBottom: "20px",
                  userSelect: "none",
                }}
              >
                {/* Custom checkbox */}
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "5px",
                    border: `2px solid ${checked ? accent : muted}`,
                    background: checked ? accent : "transparent",
                    flexShrink: 0,
                    marginTop: "1px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  {checked && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <input
                  id="age-confirm-checkbox"
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  style={{ display: "none" }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    color: text,
                    lineHeight: 1.5,
                  }}
                >
                  I confirm that I am{" "}
                  <strong style={{ color: accent }}>18 years of age or older</strong>{" "}
                  and I consent to accessing adult content. I understand this
                  setting is stored on this device only.
                </span>
              </label>

              {/* Actions */}
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={onDismiss}
                  style={{
                    flex: 1,
                    padding: "11px",
                    borderRadius: "10px",
                    background: "transparent",
                    border: `1px solid ${cardBorder}`,
                    color: muted,
                    fontSize: "13.5px",
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.15s ease",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={!checked}
                  style={{
                    flex: 2,
                    padding: "11px",
                    borderRadius: "10px",
                    background: checked
                      ? `linear-gradient(135deg, ${accent}, #FBBF24)`
                      : isDark
                      ? "#1A1A1A"
                      : "#E5E7EB",
                    border: "none",
                    color: checked ? "#000" : muted,
                    fontSize: "13.5px",
                    fontWeight: 600,
                    cursor: checked ? "pointer" : "not-allowed",
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.2s ease",
                    opacity: checked ? 1 : 0.5,
                  }}
                >
                  Confirm — I am 18+
                </button>
              </div>

              {/* Legal note */}
              <p
                style={{
                  fontSize: "11px",
                  color: muted,
                  textAlign: "center",
                  marginTop: "14px",
                  lineHeight: 1.5,
                  opacity: 0.7,
                }}
              >
                This verification is stored locally on your device. No personal
                data is transmitted. You can revoke access anytime in Settings.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
