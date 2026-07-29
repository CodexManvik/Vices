/**
 * useMotionPreference.ts
 *
 * Honours the OS "reduce motion" setting, with a user override.
 *
 * Precedence: explicit user choice (persisted) > OS preference.
 * The chosen mode is written to <html data-motion> so theme.css can zero out
 * every duration in one place rather than each component checking a flag.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "aethel_motion_override";      // "full" | "reduced" | absent
const NOTICE_KEY = "aethel_motion_notice_seen";

export type MotionMode = "full" | "reduced";

export function useMotionPreference() {
  const [osReduced, setOsReduced] = useState(false);
  const [override, setOverride] = useState<MotionMode | null>(
    () => (localStorage.getItem(KEY) as MotionMode | null) ?? null,
  );
  const [showNotice, setShowNotice] = useState(false);

  // Track the OS setting live (users can change it while the app is open).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setOsReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const mode: MotionMode = override ?? (osReduced ? "reduced" : "full");

  // Reflect onto <html> for the CSS layer.
  useEffect(() => {
    document.documentElement.setAttribute("data-motion", mode);
  }, [mode]);

  // Tell the user once that we've minimised animations for them.
  useEffect(() => {
    if (osReduced && !override && localStorage.getItem(NOTICE_KEY) !== "true") {
      setShowNotice(true);
    }
  }, [osReduced, override]);

  const dismissNotice = useCallback(() => {
    localStorage.setItem(NOTICE_KEY, "true");
    setShowNotice(false);
  }, []);

  const enableAnyway = useCallback(() => {
    localStorage.setItem(KEY, "full");
    localStorage.setItem(NOTICE_KEY, "true");
    setOverride("full");
    setShowNotice(false);
  }, []);

  const setMode = useCallback((m: MotionMode | null) => {
    if (m === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, m);
    setOverride(m);
  }, []);

  return { mode, osReduced, override, setMode, showNotice, dismissNotice, enableAnyway };
}
