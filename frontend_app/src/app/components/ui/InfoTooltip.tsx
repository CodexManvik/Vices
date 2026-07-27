/**
 * InfoTooltip.tsx — a small hover "?" that explains what a setting does.
 * Theme-aware via --v-* tokens; positioned above the trigger.
 */
import { useState } from "react";
import { HelpCircle } from "lucide-react";

export function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <HelpCircle
        size={13}
        style={{ color: "var(--v-text-faint)", cursor: "help" }}
      />
      {show && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-60 p-2.5 rounded-lg text-[11px] leading-relaxed pointer-events-none"
          style={{
            background: "var(--v-surface)",
            border: "1px solid var(--v-border-strong)",
            color: "var(--v-text)",
            boxShadow: "var(--v-shadow-lg)",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
