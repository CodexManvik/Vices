import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, ImagePlus, ChevronDown, Circle, Sparkle, Mic } from "lucide-react";
import { Avatar } from "./components/avatar";

type Msg = { id: number; from: "you" | "rosia"; text: string; imageSrc?: string };

function getApiBaseUrl() {

  const envUrl = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/+$/, "");
  return "https://commissioner-twin-submitted-protest.trycloudflare.com";
}

export default function App() {
  const apiBaseUrl = getApiBaseUrl();

  const [activeTab, setActiveTab] = useState<"chat" | "models">("chat");
  const [message, setMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("dolphin-mistral-24b.gguf");
  const [modelOpen, setModelOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [models, setModels] = useState<string[]>([
    "dolphin-mistral-24b.gguf",
    "noir-llama-70b.gguf",
    "obsidian-claude.gguf",
    "midnight-gpt-4.gguf",
  ]);

  const [messages, setMessages] = useState<Msg[]>([]);

  const [showNotice, setShowNotice] = useState(true);

  const [status, setStatus] = useState({ chemistry: 50, mood: "neutral", tone: "casual", depth: "surface" });

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
    // Best-effort: supports both real SSE ("data: ...") and plain streamed text chunks.
    const lines = chunkText.split(/\r?\n/);
    const dataLines = lines
      .map((l) => l.trimEnd())
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart());
    return dataLines;
  }

  async function send() {
    if (typing) return;
    const t = message.trim();
    if (!t && !selectedImage) return;

    setErrorText(null);

    const id = Date.now();
    const assistantId = id + 1;

    setMessages((m: Msg[]) => [...m, { id, from: "you", text: t, imageSrc: selectedImage || undefined }]);
    setMessage("");
    setSelectedImage(null);

    setMessages((m: Msg[]) => [...m, { id: assistantId, from: "rosia", text: "" }]);
    setTyping(true);

    try {
      const fd = new FormData();
      fd.append("user_input", t);
      fd.append("target_model", selectedModel);
      if (selectedImage) {
        const blob = await fetch(selectedImage).then(r => r.blob());
        fd.append("image", blob, "image.png");
      }

      const res = await fetch(`${apiBaseUrl}/chat`, { method: "POST", body: fd });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`POST /chat failed (${res.status}) ${text}`.trim());
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          
          // The backend sends plain text chunks, not SSE.
          // Extract any SSE data lines just in case (e.g., if we point to another backend),
          // but otherwise just append the raw chunk.
          const dataLines = extractSseDataLines(chunk);
          if (dataLines.length) {
            for (const dl of dataLines) appendToAssistant(assistantId, dl);
          } else {
            appendToAssistant(assistantId, chunk);
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
    // Load models on mount; also covers when you navigate to models tab.
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputDisabled = useMemo(() => typing, [typing]);

  if (showNotice) {
    return (
      <div className="dark relative h-screen w-full bg-[#070406] text-neutral-200 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-3xl border border-white/[0.08] bg-black/40 backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] p-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">about this ai</p>
              <h1 className="mt-2 text-neutral-100" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "2rem" }}>
                Completely Private & Open Development
              </h1>
              <div className="mt-4 text-sm leading-relaxed text-neutral-300 space-y-3">
                <p>• <span className="text-[#e87a8c] font-medium">No data is saved anywhere</span> This is a fully private experience.</p>
                <p>• <span className="text-[#e87a8c] font-medium">Actively in development</span> You can experiment freely and go as degenerate as you want 😉 </p>
                <p>• <span className="text-[#e87a8c] font-medium">Your feedback matters</span> DM me on Discord with suggestions, bugs, or ideas.</p>
                <p>• <span className="text-[#e87a8c] font-medium">The model WILL hallucinate</span> I am currently working on this.</p>
                <p>• <span className="text-[#e87a8c] font-medium">Slow response?</span> The model is running on my system locally, slow response means something important is running in the background 😗.</p>
              </div>
            </div>

            <button
              onClick={() => setShowNotice(false)}
              className="shrink-0 h-11 px-5 rounded-xl bg-gradient-to-br from-[#5a0c1c] via-[#8a1a30] to-[#3a0814] border border-[#c8324a]/40 text-neutral-100 text-xs uppercase tracking-[0.25em] shadow-[0_0_25px_rgba(140,20,40,0.4)] hover:shadow-[0_0_35px_rgba(140,20,40,0.6)] transition-shadow"
            >
              enter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dark relative h-screen w-full overflow-hidden bg-[#070406] text-neutral-200">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(140,20,40,0.28), transparent 60%)" }}
          animate={{ x: [0, 40, 0], y: [0, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -right-32 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(60,10,80,0.3), transparent 60%)" }}
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.85))]" />
      </div>

      <div className="relative h-full flex flex-col">
        <motion.nav
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex items-center justify-between px-10 py-5 border-b border-white/[0.04] backdrop-blur-2xl bg-black/40"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3a0a18] to-[#1a040a] border border-[#5a1828]/40 flex items-center justify-center shadow-[0_0_20px_rgba(140,20,40,0.4)]">
                <Sparkle className="w-4 h-4 text-[#c8324a]" fill="#c8324a" />
              </div>
              <motion.div
                className="absolute inset-0 rounded-lg border border-[#c8324a]/30"
                animate={{ opacity: [0, 0.6, 0], scale: [1, 1.4, 1.6] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="tracking-[0.3em] text-neutral-100"
                style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "1.7rem" }}
              >
                VICES
              </span>
            </div>
          </div>

          <div className="flex gap-1 bg-black/60 p-1 rounded-full border border-white/[0.05] backdrop-blur-xl">
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
                  <motion.div
                    layoutId="tab"
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-[#5a0c1c] to-[#8a1a30] shadow-[0_0_20px_rgba(140,20,40,0.5)]"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span
                  className={`relative ${activeTab === tab ? "text-white" : "text-neutral-500 hover:text-neutral-300"}`}
                >
                  {tab}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-neutral-500">
            <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
            <span>online</span>
          </div>
        </motion.nav>

        <div className="flex-1 grid grid-cols-[440px_1fr] gap-6 p-6 overflow-hidden">
          <motion.aside
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            className="relative rounded-3xl overflow-hidden border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a040a] via-[#08030a] to-black" />
            <div className="relative h-full flex flex-col p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Companion</p>
                  <h2
                    className="text-neutral-100 mt-1"
                    style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "1.75rem", letterSpacing: "0.05em" }}
                  >
                    Rosia
                  </h2>
                </div>
                <motion.div
                  className="px-3 py-1 rounded-full border border-[#c8324a]/30 bg-[#c8324a]/10 text-[10px] uppercase tracking-[0.2em] text-[#e87a8c]"
                  animate={{
                    boxShadow: [
                      "0 0 0px rgba(200,50,74,0.3)",
                      "0 0 18px rgba(200,50,74,0.5)",
                      "0 0 0px rgba(200,50,74,0.3)",
                    ],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  alive
                </motion.div>
              </div>

              <motion.div
                className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/[0.06] bg-black"
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.4 }}
              >
                <Avatar />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-neutral-400">
                  <span>pixel · v2</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    rendering
                  </span>
                </div>
              </motion.div>


            </div>
          </motion.aside>

          <motion.section
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            className="relative flex flex-col rounded-3xl overflow-hidden border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a040a] via-black to-[#08030a]" />

            <div className="relative px-7 py-5 border-b border-white/[0.05] flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                  {activeTab === "models" ? "models" : "conversation"}
                </p>
                <h2
                  className="text-neutral-100 mt-0.5"
                  style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "1.5rem" }}
                >
                  {activeTab === "models" ? "choose your engine" : "whispers in the dark"}
                </h2>
              </div>

              {activeTab === "models" ? (
                <div className="relative">
                  <button
                    onClick={() => fetchModels()}
                    className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/[0.06] bg-black/40 hover:bg-black/60 hover:border-[#c8324a]/30 transition-all"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c8324a] shadow-[0_0_8px_rgba(200,50,74,0.8)]" />
                    <span className="text-xs text-neutral-300 font-mono">refresh</span>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setModelOpen((o: boolean) => !o)}
                    className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/[0.06] bg-black/40 hover:bg-black/60 hover:border-[#c8324a]/30 transition-all"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c8324a] shadow-[0_0_8px_rgba(200,50,74,0.8)]" />
                    <span className="text-xs text-neutral-300 font-mono">{selectedModel}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${modelOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {modelOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.18 }}
                        className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-white/[0.08] bg-[#0a060a]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-20"
                      >
                        {models.map((m: string) => (
                          <button
                            key={m}
                            onClick={() => {
                              setModelOpen(false);
                              if (m !== selectedModel) switchModel(m);
                            }}
                            className={`w-full text-left px-4 py-3 text-xs font-mono flex items-center gap-2 transition-colors ${
                              m === selectedModel
                                ? "bg-[#c8324a]/10 text-[#e87a8c]"
                                : "text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200"
                            }`}
                          >
                            <div className={`w-1 h-1 rounded-full ${m === selectedModel ? "bg-[#c8324a]" : "bg-neutral-600"}`} />
                            {m}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="relative flex-1 overflow-y-auto px-7 py-6 space-y-5 scrollbar-thin">
              {activeTab === "models" ? (
                <div className="space-y-3">
                  {models.map((m: string) => (
                    <button
                      key={m}
                      onClick={() => switchModel(m)}
                      className={`w-full text-left px-4 py-3 rounded-2xl border transition-colors ${
                        m === selectedModel
                          ? "bg-[#c8324a]/10 border-[#c8324a]/30 text-[#e87a8c]"
                          : "bg-white/[0.02] border-white/[0.06] text-neutral-300 hover:bg-white/[0.04] hover:border-[#c8324a]/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-mono break-words">{m}</span>
                        {m === selectedModel && <span className="text-[10px] uppercase tracking-[0.25em] text-[#e87a8c]">active</span>}
                      </div>
                    </button>
                  ))}
                  {errorText && (
                    <div className="px-5 py-3 rounded-2xl border border-red-500/30 bg-red-950/40 text-red-200 text-sm">
                      {errorText}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <AnimatePresence initial={false}>
                    {messages.map((m: Msg) => (
                      <motion.div
                        key={m.id}
                        layout
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className={`flex ${m.from === "you" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[68%] ${m.from === "you" ? "items-end" : "items-start"} flex flex-col`}>
                          <span
                            className={`text-[9px] uppercase tracking-[0.3em] mb-1.5 ${
                              m.from === "you" ? "text-neutral-600" : "text-[#e87a8c]"
                            }`}
                          >
                            {m.from}
                          </span>
                          {m.from === "you" ? (
                            <div className="flex flex-col gap-2 items-end">
                              {m.imageSrc && (
                                <div className="rounded-xl overflow-hidden border border-white/[0.06] max-w-xs">
                                  <img src={m.imageSrc} alt="uploaded" className="max-w-full h-auto" />
                                </div>
                              )}
                              {m.text && (
                                <div className="px-5 py-3 rounded-2xl rounded-tr-md bg-gradient-to-br from-[#1a1418] to-[#0a0608] border border-white/[0.06] text-neutral-200 text-sm leading-relaxed shadow-lg">
                                  {m.text}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="relative px-5 py-3 rounded-2xl rounded-tl-md bg-gradient-to-br from-[#2a0810] to-[#1a040a] border border-[#5a1828]/40 text-neutral-100 text-sm leading-relaxed shadow-[0_8px_30px_rgba(140,20,40,0.2)]">
                              <div className="absolute inset-0 rounded-2xl rounded-tl-md bg-gradient-to-br from-[#c8324a]/5 to-transparent pointer-events-none" />
                              <span className="relative whitespace-pre-wrap">{m.text}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {errorText && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex justify-start"
                    >
                      <div className="px-5 py-3 rounded-2xl rounded-tl-md bg-red-950/40 border border-red-500/30 text-red-200 text-sm leading-relaxed shadow-[0_8px_30px_rgba(255,0,0,0.12)]">
                        {errorText}
                      </div>
                    </motion.div>
                  )}

                  {typing && (
                    <motion.div
                      key="typing"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex justify-start"
                    >
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-[0.3em] mb-1.5 text-[#e87a8c]">rosia</span>
                        <div className="px-5 py-4 rounded-2xl rounded-tl-md bg-gradient-to-br from-[#2a0810] to-[#1a040a] border border-[#5a1828]/40 flex gap-1.5">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-[#e87a8c]"
                              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>

            {activeTab === "chat" && (
              <div className="relative border-t border-white/[0.05] p-5 bg-black/40 backdrop-blur-xl">
                <div className="flex items-end gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const imageSrc = event.target?.result as string;
                          setSelectedImage(imageSrc);
                          e.target.value = "";
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    hidden
                    id="image-input"
                  />
                  <div className="relative">
                    <button
                      onClick={() => document.getElementById("image-input")?.click()}
                      className={selectedImage ? "w-11 h-11 rounded-xl border border-[#c8324a]/50 bg-[#c8324a]/10 flex items-center justify-center transition-all" : "w-11 h-11 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#c8324a]/30 flex items-center justify-center transition-all group"}
                      title="Add image"
                    >
                      <ImagePlus className={selectedImage ? "w-4 h-4 text-[#e87a8c]" : "w-4 h-4 text-neutral-500 group-hover:text-[#e87a8c] transition-colors"} />
                    </button>
                    {selectedImage && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#c8324a] border border-black flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-white" />
                      </div>
                    )}
                  </div>

                  <div className="group relative">
                    <button
                      className="w-11 h-11 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.06] flex items-center justify-center transition-all cursor-not-allowed opacity-50"
                      disabled
                    >
                      <Mic className="w-4 h-4 text-neutral-500" />
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-black/90 border border-white/[0.1] text-[10px] uppercase tracking-[0.15em] text-neutral-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      coming soon
                    </div>
                  </div>

                  <div className="flex-1 relative">
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      placeholder="say something to her..."
                      rows={1}
                      disabled={inputDisabled}
                      className="w-full resize-none bg-black/50 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#c8324a]/40 focus:bg-black/70 transition-all max-h-32 disabled:opacity-60"
                    />
                  </div>

                  <motion.button
                    onClick={send}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    disabled={inputDisabled}
                    className="h-11 px-5 rounded-xl bg-gradient-to-br from-[#5a0c1c] via-[#8a1a30] to-[#3a0814] border border-[#c8324a]/40 text-neutral-100 flex items-center gap-2 text-xs uppercase tracking-[0.25em] shadow-[0_0_25px_rgba(140,20,40,0.4)] hover:shadow-[0_0_35px_rgba(140,20,40,0.6)] transition-shadow disabled:opacity-60"
                  >
                    <span>send</span>
                    <Send className="w-3.5 h-3.5" />
                  </motion.button>
                </div>

                <p className="text-[10px] text-neutral-600 mt-2.5 text-center tracking-[0.2em] uppercase">
                  enter to send · shift + enter for newline
                </p>
              </div>
            )}
          </motion.section>
        </div>
      </div>
    </div>
  );
}
