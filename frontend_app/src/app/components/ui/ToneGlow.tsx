/**
 * ToneGlow.tsx
 *
 * Ambient visualisation of the agent's conversational tone.
 *
 * Two layers, deliberately different in behaviour:
 *   • sweep — a light travels once around the border when the tone CHANGES.
 *             Fires on change only; firing every message would be noise.
 *   • leak  — a soft colour bleed behind the element that persists, so the
 *             current tone is always readable at a glance.
 *
 * Colours come from --v-tone-* tokens so light/dark are handled by the theme.
 */

import { useEffect, useRef, useState } from "react";

/** Tone states emitted by the backend tone engine (mood × energy). */
export type ToneName =
  | "neutral" | "positive" | "warm" | "enthusiastic" | "calm"
  | "relaxed" | "guarded" | "tense" | "downcast" | "flat";

const KNOWN: ToneName[] = [
  "neutral", "positive", "warm", "enthusiastic", "calm",
  "relaxed", "guarded", "tense", "downcast", "flat",
];

export function toneColorVar(tone?: string): string {
  const t = (tone || "neutral").toLowerCase();
  return KNOWN.includes(t as ToneName)
    ? `var(--v-tone-${t})`
    : "var(--v-tone-neutral)";
}

/**
 * Returns a ref-able className flag that pulses when `tone` changes.
 * Skips the very first render so the app doesn't flash on mount.
 */
export function useToneChange(tone: string | undefined): boolean {
  const [active, setActive] = useState(false);
  const prev = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const next = (tone || "neutral").toLowerCase();
    if (prev.current === undefined) {
      prev.current = next;   // first paint: adopt silently
      return;
    }
    if (prev.current === next) return;
    prev.current = next;

    setActive(false);
    // Force a reflow-free restart on the next frame so the CSS animation
    // replays even when the class was already applied.
    const raf = requestAnimationFrame(() => setActive(true));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), 1800);

    return () => cancelAnimationFrame(raf);
  }, [tone]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return active;
}

interface ToneGlowProps {
  tone?: string;
  /** Hide entirely when the tone engine is off. */
  enabled?: boolean;
  /** Dim the ambient leak (e.g. while the user is typing). */
  dim?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Matches the child's border radius so the sweep tracks its outline. */
  radius?: string;
}

/**
 * Wraps an element (the prompt box) with the sweep + ambient leak.
 * Renders children untouched when disabled, so it's safe to always mount.
 */
export function ToneGlow({
  tone,
  enabled = true,
  dim = false,
  children,
  className = "",
  radius = "var(--v-radius-lg)",
}: ToneGlowProps) {
  const sweeping = useToneChange(enabled ? tone : undefined);
  const color = toneColorVar(tone);

  if (!enabled) return <div className={className}>{children}</div>;

  return (
    <div
      className={`v-tone-wrap ${className}`}
      style={{ ["--v-tone-color" as string]: color }}
    >
      <div
        className="v-tone-leak"
        style={dim ? { opacity: "calc(var(--v-glow-strength) * 0.45)" } : undefined}
        aria-hidden="true"
      />
      <div
        className={`v-tone-sweep${sweeping ? " is-active" : ""}`}
        style={{ borderRadius: radius }}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
