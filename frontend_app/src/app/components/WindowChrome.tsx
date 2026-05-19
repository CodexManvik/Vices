import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface WindowChromeProps {
  isDark: boolean;
}

export function WindowChrome({ isDark }: WindowChromeProps) {
  const appWindow = getCurrentWindow();

  return (
    <div
      // 1. Explicitly trigger the OS drag behavior on mouse down
      onMouseDown={() => appWindow.startDragging()}
      className="relative h-8 w-full flex items-center justify-between select-none shrink-0 z-50 cursor-grab active:cursor-grabbing"
      style={{
        background: isDark ? "rgba(10,10,10,0.6)" : "rgba(250,250,249,0.7)",
        borderBottom: isDark
          ? "1px solid rgba(255,255,255,0.04)"
          : "1px solid rgba(0,0,0,0.04)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Traffic-light controls (macOS left side) */}
      <div 
        className="flex items-center gap-2 px-3 group" 
        // Prevent the drag event from firing when we click a button
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => appWindow.close()}
          className="w-3 h-3 rounded-full flex items-center justify-center transition-colors"
          style={{ background: "#FF5F57" }}
          aria-label="Close"
        >
          <X
            size={7}
            strokeWidth={2.5}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "#4d0000" }}
          />
        </button>
        <button
          onClick={() => appWindow.minimize()}
          className="w-3 h-3 rounded-full flex items-center justify-center transition-colors"
          style={{ background: "#FEBC2E" }}
          aria-label="Minimize"
        >
          <Minus
            size={7}
            strokeWidth={3}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "#5a3a00" }}
          />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="w-3 h-3 rounded-full flex items-center justify-center transition-colors"
          style={{ background: "#28C840" }}
          aria-label="Maximize"
        >
          <Square
            size={6}
            strokeWidth={3}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "#003d00" }}
          />
        </button>
      </div>

      {/* Center title */}
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "11px",
          letterSpacing: "0.3em",
          color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.4)",
          textTransform: "uppercase",
        }}
      >
        VICES CORE
      </div>
      
      {/* Empty right div to keep the title perfectly centered */}
      <div className="w-[60px]" />
    </div>
  );
}