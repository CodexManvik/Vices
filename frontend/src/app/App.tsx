// App.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, ImagePlus, ChevronDown, Circle, Sparkle, X, Camera } from "lucide-react";
import { Avatar } from "./components/avatar";

type Msg = { id: number; from: "you" | "rosia"; text: string; mediaUrls?: string[] };

function getApiBaseUrl() {
  const envUrl = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/+$/, "");
  return "https://delaware-only-dryer-interior.trycloudflare.com"; 
}

// Upgraded text formatter for inline image generation!
function formatMessageText(text: string, mediaUrls: string[] = [], isAi: boolean = false) {
  if (!text) return null;
  
  // Split by either bold tags OR the selfie trigger (even if it's incomplete during streaming)
  const parts = text.split(/(\[TRIGGER_SELFIE:[^\]]*\]?|\*\*.*?\*\*)/g);
  
  return parts.map((part, index) => {
    // 1. Render Bold Text
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={index} className="font-bold text-neutral-50 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // 2. Render Inline Image or Loading State
    if (isAi && part.startsWith('[TRIGGER_SELFIE:')) {
       // If the image finished generating and we have the URL from the backend
       if (mediaUrls && mediaUrls.length > 0) {
          return (
             <div key={index} className="my-3 rounded-xl overflow-hidden border border-[#5a1828]/60 shadow-[0_8px_30px_rgba(140,20,40,0.3)] w-full sm:w-80">
                 <img src={mediaUrls[0]} alt="Selfie" className="w-full h-auto object-cover" />
             </div>
          );
       } 
       // Otherwise, render the loading bubble inline while the GPU swaps!
       else {
          return (
             <span key={index} className="inline-flex items-center gap-2 px-3 py-1.5 mx-1 rounded-lg bg-[#c8324a]/20 border border-[#c8324a]/40 text-[#e87a8c] text-xs font-medium animate-pulse shadow-[0_0_15px_rgba(200,50,74,0.3)]">
                 <Camera className="w-3.5 h-3.5" />
                 taking a photo...
             </span>
          );
       }
    }

    return <span key={index}>{part}</span>;
  });
}

export default function App() {
  const apiBaseUrl = getApiBaseUrl();

  const [activeTab, setActiveTab] = useState<"chat" | "models">("chat");
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedModel, setSelectedModel] = useState("dolphin-mistral-24b.gguf");
  const [modelOpen, setModelOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [activityStatus, setActivityStatus] = useState<string>("typing...");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [correctingId, setCorrectingId] = useState<number | null>(null);
  const [correctionText, setCorrectionText] = useState("");

  const [models, setModels] = useState<string[]>([
    "dolphin-mistral-24b.gguf",
    "noir-llama-70b.gguf",
    "obsidian-claude.gguf",
    "midnight-gpt-4.gguf",
  ]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [showNotice, setShowNotice] = useState(true);
  const [_status, setStatus] = useState({ chemistry: 50, mood: "neutral", tone: "casual", depth: "surface" });

  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    const timer = setTimeout(() => {
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  async function fetchStatus() {
    try {
      const res = await fetch(`${apiBaseUrl}/status`);
      if (res.ok) setStatus(await res.json());
    } catch {}
  }

  useEffect(() => {
    if (!typing) fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing]);

  async function fetchModels() {
    setErrorText(null);
    try {
      const res = await fetch(`${apiBaseUrl}/models`, { method: "GET" });
      if (!res.ok) throw new Error(`GET /models failed (${res.status})`);
      const data = (await res.json()) as { models: string[]; active?: string };
      if (Array.isArray(data.models) && data.models.length) setModels(data.models);
      if (data.active) setSelectedModel(data.active);
    } catch (e: any) {
      setErrorText(e?.message ?? "Failed to load models from backend.");
    }
  }

  async function switchModel(nextModel: string) {
    setErrorText(null);
    setSelectedModel(nextModel);
    try {
      const fd = new FormData();
      fd.append("model_name", nextModel);
      const res = await fetch(`${apiBaseUrl}/switch_model`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`POST /switch_model failed (${res.status})`);
      await res.json().catch(() => null);
    } catch (e: any) {
      setErrorText(e?.message ?? "Failed to switch model.");
    }
  }

  function appendToAssistant(assistantId: number, chunkText: string) {
    if (!chunkText) return;
    setMessages((prev: Msg[]) =>
      prev.map((x: Msg) => (x.id === assistantId ? { ...x, text: x.text + chunkText } : x))
    );
  }

  function extractSseDataLines(chunkText: string) {
    const lines = chunkText.split(/\r?\n/);
    return lines
      .map((l) => l.trimEnd())
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart());
  }

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  async function submitCorrection(msgId: number, originalInput: string, badResponse: string) {
    if (!correctionText.trim()) return;

    try {
      await fetch(`${apiBaseUrl}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_input: originalInput,
          rejected_response: badResponse,
          chosen_response: correctionText
        })
      });
      setCorrectingId(null);
      setCorrectionText("");
    } catch (e) {
      console.error("Failed to save feedback", e);
    }
  }

  async function send() {
    if (typing) return;
    const t = message.trim();
    if (!t && selectedFiles.length === 0) return;

    setErrorText(null);

    const id = Date.now();
    const assistantId = id + 1;

    const mediaUrls = selectedFiles.map((file) => URL.createObjectURL(file));

    setMessages((m: Msg[]) => [...m, { id, from: "you", text: t, mediaUrls }]);
    setMessage("");
    setSelectedFiles([]);

    setMessages((m: Msg[]) => [...m, { id: assistantId, from: "rosia", text: "", mediaUrls: [] }]);
    
    if (selectedFiles.some(f => f.type.includes('gif') || f.type.includes('video'))) {
      setActivityStatus("analyzing media...");
    } else if (t.includes("http")) {
      setActivityStatus("reading link...");
    } else if (selectedFiles.length > 0) {
      setActivityStatus("looking at image...");
    } else {
      setActivityStatus("typing...");
    }

    setTyping(true);

    try {
      const fd = new FormData();
      fd.append("user_input", t);
      fd.append("target_model", selectedModel);
      
      selectedFiles.forEach((file) => {
        fd.append("files", file);
      });

      const res = await fetch(`${apiBaseUrl}/chat`, { 
        method: "POST", 
        body: fd
      });
      
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`POST /chat failed (${res.status}) ${text}`.trim());
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      const processChunk = (rawText: string) => {
        const attachmentRegex = /\[SYSTEM_MEDIA_ATTACHMENT:\s*(file:\/\/[^\]]+)\]/g;
        let match;
        let cleanText = rawText;

        while ((match = attachmentRegex.exec(rawText)) !== null) {
          const fileUrl = match[1];
          const filename = fileUrl.replace("file://", "");
          const imageUrl = `${apiBaseUrl}/images/${filename}`;

          setMessages((prev: Msg[]) =>
            prev.map((x: Msg) =>
              x.id === assistantId
                ? { ...x, mediaUrls: [...(x.mediaUrls || []), imageUrl] }
                : x
            )
          );
          cleanText = cleanText.replace(match[0], "");
        }

        if (cleanText) {
          appendToAssistant(assistantId, cleanText);
        }
      };

      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const dataLines = extractSseDataLines(chunk);
          if (dataLines.length) {
            for (const dl of dataLines) processChunk(dl);
          } else {
            processChunk(chunk);
          }
        }
      }
    } catch (e: any) {
      setErrorText(e?.message ?? "Chat request failed.");
      setMessages((m: Msg[]) =>
        m.map((x: Msg) => (x.id === assistantId ? { ...x, text: x.text || "[error]" } : x))
      );
    } finally {
      setTyping(false);
    }
  }

  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputDisabled = useMemo(() => typing, [typing]);

  if (showNotice) {
    return (
      <div className="dark relative h-screen w-full bg-[#070406] text-neutral-200 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-2xl rounded-3xl border border-white/[0.08] bg-black/40 backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start justify-between gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">about this ai</p>
              <h1 className="mt-2 text-neutral-100" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "2rem" }}>
                Completely Private & Open Development
              </h1>
              <div className="mt-4 text-sm leading-relaxed text-neutral-300 space-y-3">
                <p>• <span className="text-[#e87a8c] font-medium">No data is saved anywhere</span> This is a fully private experience.</p>
                <p>• <span className="text-[#e87a8c] font-medium">Actively in development</span> You can experiment freely and go as degenerate as you want 😉</p>
                <p>• <span className="text-[#e87a8c] font-medium">Your feedback matters</span> DM me on Discord with suggestions, bugs, or ideas.</p>
                <p>• <span className="text-[#e87a8c] font-medium">The model WILL hallucinate</span> I am currently working on this.</p>
                <p>• <span className="text-[#e87a8c] font-medium">Slow response?</span> The model is running locally, slow responses mean heavy computing is happening 😗.</p>
                <p>• <span className="text-[#e87a8c] font-medium">Fictional Selfies</span> The image generator is not trained on real photos of anyone. The pictures sent are completely artificial.</p>
              </div>
            </div>

            <button
              onClick={() => setShowNotice(false)}
              className="w-full md:w-auto shrink-0 h-11 px-6 rounded-xl bg-gradient-to-br from-[#5a0c1c] via-[#8a1a30] to-[#3a0814] border border-[#c8324a]/40 text-neutral-100 text-xs uppercase tracking-[0.25em] shadow-[0_0_25px_rgba(140,20,40,0.4)] hover:shadow-[0_0_35px_rgba(140,20,40,0.6)] transition-shadow"
            >
              enter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dark relative h-[100dvh] w-full overflow-hidden bg-[#070406] text-neutral-200">
      <div className="pointer-events-none absolute inset-0 will-change-transform">
        <motion.div
          className="absolute -top-32 -left-32 w-[300px] md:w-[520px] h-[300px] md:h-[520px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(140,20,40,0.20), transparent 60%)" }}
          animate={{ x: [0, 20, 0], y: [0, 10, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -bottom-40 -right-32 w-[400px] md:w-[600px] h-[400px] md:h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(60,10,80,0.25), transparent 60%)" }}
          animate={{ x: [0, -20, 0], y: [0, -10, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)", backgroundSize: "32px 32px" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.85))]" />
      </div>

      <div className="relative h-full flex flex-col max-w-7xl mx-auto">
        <motion.nav
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex items-center justify-between px-4 md:px-10 py-3 md:py-5 border-b border-white/[0.04] backdrop-blur-md bg-black/40 z-10"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-[#3a0a18] to-[#1a040a] border border-[#5a1828]/40 flex items-center justify-center shadow-[0_0_20px_rgba(140,20,40,0.4)]">
                <Sparkle className="w-4 h-4 text-[#c8324a]" fill="#c8324a" />
              </div>
              <motion.div
                className="absolute inset-0 rounded-lg border border-[#c8324a]/30"
                animate={{ opacity: [0, 0.6, 0], scale: [1, 1.3, 1.5] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="tracking-[0.3em] text-neutral-100" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "1.5rem" }}>
                VICES
              </span>
            </div>
          </div>

          <div className="hidden md:flex gap-1 bg-black/60 p-1 rounded-full border border-white/[0.05] backdrop-blur-xl">
            {(["chat", "models"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === "models") fetchModels();
                }}
                className="relative px-7 py-2 rounded-full text-xs uppercase tracking-[0.25em] transition-colors"
              >
                {activeTab === tab && (
                  <motion.div layoutId="tab" className="absolute inset-0 rounded-full bg-gradient-to-r from-[#5a0c1c] to-[#8a1a30] shadow-[0_0_20px_rgba(140,20,40,0.5)]" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                )}
                <span className={`relative ${activeTab === tab ? "text-white" : "text-neutral-500 hover:text-neutral-300"}`}>{tab}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-neutral-500">
            <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
            <span className="hidden sm:inline">online</span>
          </div>
        </motion.nav>

        {/* Mobile Tab Selector */}
        <div className="md:hidden flex px-4 pt-3 gap-2">
           {(["chat", "models"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); if (tab === "models") fetchModels(); }}
                className={`flex-1 py-2 rounded-xl text-[10px] uppercase tracking-[0.2em] transition-colors ${activeTab === tab ? "bg-[#c8324a]/20 border border-[#c8324a]/30 text-[#e87a8c]" : "bg-black/40 border border-white/[0.05] text-neutral-500"}`}
              >
                {tab}
              </button>
            ))}
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[400px_1fr] lg:grid-cols-[440px_1fr] gap-3 md:gap-6 p-3 md:p-6 overflow-hidden">
          {/* Avatar Area (Hidden on models tab in mobile) */}
          <motion.aside
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className={`relative rounded-3xl overflow-hidden border border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-md shadow-2xl ${activeTab !== 'chat' ? 'hidden md:block' : ''}`}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a040a] via-[#08030a] to-black" />
            <div className="relative h-full flex flex-col p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Companion</p>
                  <h2 className="text-neutral-100 mt-1" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "1.75rem", letterSpacing: "0.05em" }}>Rosia</h2>
                </div>
                <motion.div
                  className="px-3 py-1 rounded-full border border-[#c8324a]/30 bg-[#c8324a]/10 text-[10px] uppercase tracking-[0.2em] text-[#e87a8c]"
                  animate={{ boxShadow: ["0 0 0px rgba(200,50,74,0.2)", "0 0 15px rgba(200,50,74,0.4)", "0 0 0px rgba(200,50,74,0.2)"] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  alive
                </motion.div>
              </div>

              <div className="relative aspect-square w-full md:max-w-none max-w-[280px] mx-auto rounded-2xl overflow-hidden border border-white/[0.06] bg-black">
                <Avatar />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-neutral-400">
                  <span>pixel · v2</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />rendering</span>
                </div>
              </div>
            </div>
          </motion.aside>

          {/* Chat/Model Area */}
          <motion.section
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
            className={`relative flex flex-col rounded-3xl overflow-hidden border border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-md shadow-2xl ${activeTab === 'chat' && window.innerWidth < 768 ? 'mt-0' : ''}`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a040a] via-black to-[#08030a]" />

            <div className="relative px-4 md:px-7 py-3 md:py-5 border-b border-white/[0.05] flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 hidden sm:block">{activeTab === "models" ? "models" : "conversation"}</p>
                <h2 className="text-neutral-100 sm:mt-0.5 text-lg sm:text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300 }}>
                  {activeTab === "models" ? "choose your engine" : "whispers in the dark"}
                </h2>
              </div>

              {activeTab === "models" ? (
                <button onClick={() => fetchModels()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.06] bg-black/40 hover:bg-black/60 transition-all">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#c8324a]" />
                  <span className="text-[10px] sm:text-xs text-neutral-300 font-mono">refresh</span>
                </button>
              ) : (
                <div className="relative">
                  <button onClick={() => setModelOpen(!modelOpen)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.06] bg-black/40 hover:bg-black/60 transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c8324a]" />
                    <span className="text-[10px] sm:text-xs text-neutral-300 font-mono max-w-[100px] sm:max-w-[150px] truncate">{selectedModel}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${modelOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {modelOpen && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="absolute right-0 top-full mt-2 w-56 sm:w-64 rounded-xl border border-white/[0.08] bg-[#0a060a]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-20">
                        {models.map((m) => (
                          <button key={m} onClick={() => { setModelOpen(false); if (m !== selectedModel) switchModel(m); }} className={`w-full text-left px-4 py-3 text-xs font-mono flex items-center gap-2 transition-colors ${m === selectedModel ? "bg-[#c8324a]/10 text-[#e87a8c]" : "text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200"}`}>
                            <div className={`w-1 h-1 rounded-full shrink-0 ${m === selectedModel ? "bg-[#c8324a]" : "bg-neutral-600"}`} />
                            <span className="truncate">{m}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="relative flex-1 overflow-y-auto px-3 md:px-7 py-4 space-y-4 md:space-y-5 scrollbar-thin" ref={feedRef}>
              {activeTab === "models" ? (
                <div className="space-y-3">
                  {models.map((m: string) => (
                    <button key={m} onClick={() => switchModel(m)} className={`w-full text-left px-4 py-3 rounded-2xl border transition-colors ${m === selectedModel ? "bg-[#c8324a]/10 border-[#c8324a]/30 text-[#e87a8c]" : "bg-white/[0.02] border-white/[0.06] text-neutral-300 hover:bg-white/[0.04]"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-mono break-words">{m}</span>
                        {m === selectedModel && <span className="text-[10px] uppercase tracking-[0.25em] text-[#e87a8c]">active</span>}
                      </div>
                    </button>
                  ))}
                  {errorText && <div className="px-5 py-3 rounded-2xl border border-red-500/30 bg-red-950/40 text-red-200 text-sm">{errorText}</div>}
                </div>
              ) : (
                <>
                  <AnimatePresence initial={false}>
                    {messages.map((m: Msg) => (
                      <motion.div key={m.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.from === "you" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[92%] sm:max-w-[80%] md:max-w-[68%] ${m.from === "you" ? "items-end" : "items-start"} flex flex-col`}>
                          <span className={`text-[9px] uppercase tracking-[0.3em] mb-1.5 ml-1 ${m.from === "you" ? "text-neutral-600" : "text-[#e87a8c]"}`}>{m.from}</span>
                          
                          {m.from === "you" ? (
                            <div className="flex flex-col gap-2 items-end">
                              {/* Render Multiple Media Previews */}
                              {m.mediaUrls && m.mediaUrls.length > 0 && (
                                <div className="flex gap-2 flex-wrap justify-end">
                                  {m.mediaUrls.map((url, idx) => (
                                    <div key={idx} className="rounded-xl overflow-hidden border border-white/[0.06] w-32 sm:w-48">
                                      <img src={url} alt="uploaded" className="w-full h-auto object-cover" />
                                    </div>
                                  ))}
                                </div>
                              )}
                              {m.text && (
                                <div className="px-4 md:px-5 py-2.5 md:py-3 rounded-2xl rounded-tr-md bg-gradient-to-br from-[#1a1418] to-[#0a0608] border border-white/[0.06] text-neutral-200 text-[13px] md:text-sm leading-relaxed shadow-lg">
                                  {formatMessageText(m.text)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 items-start w-full relative group">
                              {m.text && (
                                <div className="relative px-4 md:px-5 py-2.5 md:py-3 rounded-2xl rounded-tl-md bg-gradient-to-br from-[#2a0810] to-[#1a040a] border border-[#5a1828]/40 text-neutral-100 text-[13px] md:text-sm leading-relaxed shadow-[0_8px_30px_rgba(140,20,40,0.2)] w-full max-w-full group">
                                  
                                  <div className="relative whitespace-pre-wrap flex flex-col gap-1">
                                    {formatMessageText(m.text, m.mediaUrls, m.from === "rosia")}
                                  </div>

                                  {/* The Correction Button - Always visible on small mobile screens, hover on desktop */}
                                  {!correctingId && (
                                    <button 
                                      onClick={() => {
                                        setCorrectingId(m.id);
                                        setCorrectionText(m.text);
                                      }}
                                      className="absolute -right-2 -top-3 md:-right-8 md:top-2 p-1.5 rounded-lg bg-[#1a040a] border border-[#5a1828]/40 text-neutral-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:text-[#e87a8c] hover:border-[#c8324a]/50 shadow-lg md:shadow-none z-10"
                                      title="Correct this response"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                  )}

                                  {/* The Correction Input Box */}
                                  {correctingId === m.id && (
                                    <div className="mt-3 pt-3 border-t border-[#5a1828]/40 flex flex-col gap-2 w-full">
                                      <span className="text-[10px] uppercase tracking-[0.2em] text-[#e87a8c] font-medium">Teach Rosia:</span>
                                      <textarea 
                                        value={correctionText}
                                        onChange={(e) => setCorrectionText(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-[13px] md:text-sm text-neutral-200 focus:outline-none focus:border-[#c8324a]/50 resize-none min-h-[80px]"
                                        rows={3}
                                      />
                                      <div className="flex justify-end gap-2 mt-1">
                                        <button onClick={() => setCorrectingId(null)} className="px-4 py-1.5 rounded-lg text-[10px] uppercase tracking-wider text-neutral-400 hover:bg-white/5 transition-colors border border-transparent">Cancel</button>
                                        <button 
                                          onClick={() => {
                                            // Find the immediately preceding user message prompt by reversing the array search
                                            const previousUserPrompt = [...messages].reverse().find(msg => msg.id < m.id && msg.from === "you")?.text || "Unknown Context";
                                            submitCorrection(m.id, previousUserPrompt, m.text);
                                          }} 
                                          className="px-4 py-1.5 rounded-lg text-[10px] uppercase tracking-wider bg-[#c8324a]/20 text-[#e87a8c] border border-[#c8324a]/30 hover:bg-[#c8324a]/40 transition-colors shadow-[0_0_15px_rgba(200,50,74,0.2)]"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {errorText && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                      <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-red-950/40 border border-red-500/30 text-red-200 text-sm shadow-[0_8px_30px_rgba(255,0,0,0.12)]">
                        {errorText}
                      </div>
                    </motion.div>
                  )}

                  {typing && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-[0.3em] mb-1.5 text-[#e87a8c] ml-1 flex items-center gap-2">
                          rosia <span className="text-neutral-500 lowercase tracking-widest">{activityStatus}</span>
                        </span>
                        <div className="px-5 py-4 rounded-2xl rounded-tl-md bg-gradient-to-br from-[#2a0810] to-[#1a040a] border border-[#5a1828]/40 flex gap-1.5 w-fit">
                          {[0, 1, 2].map((i) => (
                            <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[#e87a8c]" animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>

            {/* Chat Input Area */}
            {activeTab === "chat" && (
              <div className="relative border-t border-white/[0.05] p-2 md:p-4 bg-black/60 backdrop-blur-xl">
                
                {/* Media Preview Stage */}
                {selectedFiles.length > 0 && (
                  <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-thin">
                    {selectedFiles.map((file, idx) => (
                       <div key={idx} className="relative w-16 h-16 shrink-0 rounded-lg border border-white/[0.1] overflow-hidden bg-[#1a1a1a]">
                          {file.type.startsWith('image/') || file.type.startsWith('video/') ? (
                             <img src={URL.createObjectURL(file)} className="w-full h-full object-cover opacity-80" alt="preview" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-neutral-400 text-center p-1 break-all bg-black/50">
                              {file.name}
                            </div>
                          )}
                          <button onClick={() => removeFile(idx)} className="absolute top-1 right-1 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-[#c8324a] transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                       </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*,video/*,.gif"
                      multiple
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        if (e.target.files) {
                          setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                        }
                        if (e.target) e.target.value = "";
                      }}
                      hidden
                      id="media-input"
                    />
                    <button
                      onClick={() => document.getElementById("media-input")?.click()}
                      className={`w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-xl border flex items-center justify-center transition-all ${selectedFiles.length > 0 ? "border-[#c8324a]/50 bg-[#c8324a]/10" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"}`}
                      title="Add Media"
                    >
                      <ImagePlus className={`w-4 h-4 ${selectedFiles.length > 0 ? "text-[#e87a8c]" : "text-neutral-500"}`} />
                    </button>
                  </div>

                  <div className="flex-1 w-full min-w-[200px] order-last sm:order-none relative">
                    <textarea
                      value={message}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                      onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      placeholder="Type a message or paste a link..."
                      rows={1}
                      disabled={inputDisabled}
                      className="w-full resize-none bg-black/50 border border-white/[0.06] rounded-xl px-3 py-3 sm:px-4 text-[13px] sm:text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#c8324a]/40 transition-all max-h-32 disabled:opacity-60"
                    />
                  </div>

                  <motion.button
                    onClick={send}
                    whileTap={{ scale: 0.95 }}
                    disabled={inputDisabled}
                    className="h-10 sm:h-11 px-4 sm:px-5 shrink-0 rounded-xl bg-gradient-to-br from-[#5a0c1c] via-[#8a1a30] to-[#3a0814] border border-[#c8324a]/40 text-neutral-100 flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] shadow-lg transition-shadow disabled:opacity-60"
                  >
                    <span className="hidden sm:inline">send</span>
                    <Send className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </div>
            )}
          </motion.section>
        </div>
      </div>
    </div>
  );
}