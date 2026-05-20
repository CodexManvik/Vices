import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Gatekeeper } from "./components/Gatekeeper";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { AccessRequest } from "./components/AccessRequest";
import { AdminDashboard } from "./components/AdminDashboard";
import { MoodGlow } from "./components/MoodGlow";
import ImageInspectWindow from "./components/ImageInspectWindow";

export default function App() {
  const [authorized, setAuthorized] = useState(false);
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const authTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);

  const [status, setStatus] = useState({ chemistry: 50, mood: "neutral", tone: "casual" });

  useEffect(() => {
    if (!sessionUrl) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${sessionUrl}/status`, {
          headers: { "ngrok-skip-browser-warning": "bypass" }
        });
        if (res.ok) {
          const data = await res.json();
          setStatus({
            chemistry: data.chemistry || 50,
            mood: data.mood || "neutral",
            tone: data.tone || "casual"
          });
        }
      } catch (e) {
        console.error("Failed to fetch status:", e);
      }
    };

    fetchStatus();
    const id = setInterval(fetchStatus, 10000);
    
    return () => clearInterval(id);
  }, [sessionUrl]);

  useEffect(() => {
    return () => {
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
      }
    };
  }, []);

  // Admin panel toggle with keyboard shortcut (Ctrl+Shift+M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "M") {
        e.preventDefault();
        setShowAdminPanel((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAuthorized = (url: string) => {
    setSessionUrl(url);
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
    }
    authTimeoutRef.current = setTimeout(() => setAuthorized(true), 600);
  };

  return (
    <div
      className="relative h-screen w-full overflow-hidden flex flex-col transition-colors duration-500"
      style={{
        background: isDark ? "#0A0A0A" : "#F5F5F4",
        color: isDark ? "#E2E8F0" : "#1C1917",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <MoodGlow mood={status.mood} isDark={isDark} />

      <div className="flex-1 relative min-h-0">
        <AnimatePresence mode="wait">
          {showAdminPanel ? (
            <motion.div key="admin" exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }} transition={{ duration: 0.6 }} className="w-full h-full">
              <AdminDashboard isDark={isDark} onBack={() => setShowAdminPanel(false)} />
            </motion.div>
          ) : !authorized ? (
            showAccessRequest ? (
              <motion.div key="access-request" exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }} transition={{ duration: 0.6 }} className="w-full h-full">
                <AccessRequest isDark={isDark} onBack={() => setShowAccessRequest(false)} />
              </motion.div>
            ) : (
              <motion.div key="gate" exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }} transition={{ duration: 0.6 }} className="w-full h-full">
                <Gatekeeper onAuthorized={handleAuthorized} onRequestAccess={() => setShowAccessRequest(true)} isDark={isDark} />
              </motion.div>
            )
          ) : (
            <motion.div key="app" initial={{ opacity: 0, scale: 1.01 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: "easeOut" }} className="w-full h-full flex">
              <Sidebar isDark={isDark} toggleTheme={() => setIsDark((v) => !v)} chemistry={status.chemistry} mood={status.mood} />
              <ChatView isDark={isDark} mood={status.mood} tone={status.tone} sessionUrl={sessionUrl} onImageInspectTrigger={(url) => setActivePreviewImage(url)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Sub Window Inspection Canvas Overlay */}
        {activePreviewImage && (
          <ImageInspectWindow imageUrl={activePreviewImage} onClose={() => setActivePreviewImage(null)} />
        )}
      </div>
    </div>
  );
}