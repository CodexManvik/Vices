import React, { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Copy } from "lucide-react";

interface WindowChromeProps {
  isDark: boolean;
}

export function WindowChrome({ isDark }: WindowChromeProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const checkMaximized = async () => {
      try {
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (err) {
        console.error("Failed to query initial maximize status:", err);
      }
    };

    // Evaluate state immediately on system window paint
    checkMaximized();

    // TAURI v2 CORRECT EVENT CHANNEL: 
    // We listen to the global resize channel natively
    appWindow.listen("tauri://resize", () => {
      checkMaximized();
    }).then((unlistenFn) => {
      unlisten = unlistenFn;
    }).catch((err) => {
      console.error("Failed to bind Tauri resize listener pipeline:", err);
    });

    // Tear down active unlisten channels on container destruction
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [appWindow]);

  const handleMinimize = async () => {
    try {
      await appWindow.minimize();
    } catch (err) {
      console.error("Minimize block dropped:", err);
    }
  };

  const handleMaximize = async () => {
    try {
      // Whitelisted toggle call via default.json capabilities mapping
      await appWindow.toggleMaximize();
      await syncMaximized();
    } catch (err) {
      console.error("Tauri v2 window adjustment dropped:", err);
    }
  };

  const handleClose = async () => {
    try {
      await appWindow.close();
    } catch (err) {
      console.error("Close block dropped:", err);
    }
  };

  const syncMaximized = async () => {
    try {
      setIsMaximized(await appWindow.isMaximized());
    } catch (err) {
      console.error("Failed to resync maximize status:", err);
    }
  };

  return (
    <div
      className="flex items-center justify-between w-full h-10 select-none px-4 shrink-0 transition-colors duration-500 z-50"
      style={{
        background: isDark ? "rgba(10,10,10,0.8)" : "rgba(245,245,244,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(0,0,0,0.04)",
        color: isDark ? "#E2E8F0" : "#1C1917"
      }}
    >
      {/* macOS-style traffic lights (left side) */}
      <div className="flex items-center gap-2 h-full">
        <div
          data-tauri-no-drag
          className="flex items-center gap-2 h-full"
        >
          <button
            onClick={handleMinimize}
            data-tauri-no-drag
            className="flex items-center justify-center w-10 h-full hover:bg-white/5 active:bg-white/10 transition-colors"
            title="Minimize"
          >
            <span className="w-3 h-3 rounded-full bg-yellow-400/90 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" />
          </button>

          <button
            onClick={handleMaximize}
            data-tauri-no-drag
            className="flex items-center justify-center w-10 h-full hover:bg-white/5 active:bg-white/10 transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            <span className="w-3 h-3 rounded-full bg-emerald-400/90 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" />
          </button>

          <button
            onClick={async () => {
              await handleClose();
              await syncMaximized();
            }}
            data-tauri-no-drag
            className="flex items-center justify-center w-10 h-full hover:bg-red-500/20 hover:text-red-400 active:bg-red-500/30 transition-colors"
            title="Close"
          >
            <span className="w-3 h-3 rounded-full bg-red-500/90 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" />
          </button>
        </div>
      </div>

      {/* Title/center content (draggable area) */}
      <div
        data-tauri-drag-region
        className="flex-1 flex items-center justify-start px-2"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          <span className="tracking-widest text-[10px] font-mono uppercase opacity-40 font-bold">Vices Frame v2</span>
        </div>
      </div>
    </div>
  );
}