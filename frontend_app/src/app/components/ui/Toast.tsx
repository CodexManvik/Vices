/**
 * Toast.tsx — minimal bottom-left notice with an optional action.
 * Used for the reduced-motion notification; general enough to reuse.
 */

import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

interface ToastProps {
  open: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}

export function Toast({ open, message, actionLabel, onAction, onDismiss }: ToastProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-5 left-5 z-[70] flex items-center gap-3 px-4 py-3 rounded-[var(--v-radius)] max-w-sm"
          style={{
            background: "var(--v-surface)",
            border: "1px solid var(--v-border-strong)",
            boxShadow: "var(--v-shadow-lg)",
            color: "var(--v-text)",
          }}
        >
          <span className="text-[12.5px] leading-snug">{message}</span>
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="text-[12px] font-semibold whitespace-nowrap cursor-pointer px-2 py-1 rounded-md"
              style={{ color: "var(--v-accent)", background: "var(--v-accent-soft)" }}
            >
              {actionLabel}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="p-1 rounded-md cursor-pointer shrink-0"
            style={{ color: "var(--v-text-faint)" }}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
