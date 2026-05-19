# server.py
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import List
import asyncio
import os
import tempfile
import uvicorn
import re
from pathlib import Path
from pydantic import BaseModel
import json
from duckduckgo_search import DDGS
from datetime import datetime
import pytz

# --- VOICE INTEGRATION ---
import edge_tts

# Local Subsystem Integration
from memory import retrieve_memories
from prompt_builder import build_messages
from generation import generate_stream, get_available_models, switch_active_model
from state import state, update_state, set_active_model
from graph_memory import extract_entities_and_update, get_graph_context
from media_handler import process_url, extract_frames, TEMP_IMAGE_DIR
from image_generator import generate_selfie

# Cognitive Emotion Engine
from emotion_engine import calculate_text_delta, get_affective_state, BASELINE_VALENCE, BASELINE_AROUSAL

# UI Terminal Formatting
from rich.console import Console
from rich.panel import Panel

# ==========================================
# 🚨 CORPORATE PRESENTATION MODE 🚨
# Set to False to return to standard unrestricted persona
# ==========================================
VIDEO_RECORDING_MODE = False

app = FastAPI()
chat_lock = asyncio.Lock()
console = Console()
last_interaction_time = datetime.now()
chronos_queue = asyncio.Queue()

# ==========================================
# 1. CORS MIDDLEWARE FOR MAIN APP
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/images", StaticFiles(directory=TEMP_IMAGE_DIR), name="images")
history = []

class FeedbackData(BaseModel):
    user_input: str
    rejected_response: str
    chosen_response: str

# ==========================================
# 2. DESKTOP APP GATEKEEPER (BROKER APP)
# ==========================================
broker_app = FastAPI()

broker_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# You can set CURRENT_RUNTIME_TUNNEL via environment variable
# For production, ensure this is set to your actual tunnel/server URL
CURRENT_RUNTIME_TUNNEL = os.environ.get("CURRENT_RUNTIME_TUNNEL", "http://localhost:8000")
IS_DEVELOPER_PRESENT = True # Set to False to lock out all testers

@broker_app.post("/request-access")
async def handle_access_request(x_tester_token: str = Header(None)):
    if IS_DEVELOPER_PRESENT:
        return {"status": "allocated", "session_url": CURRENT_RUNTIME_TUNNEL}
    return {"status": "waitlisted", "detail": "Developer is offline. Hardware channels locked."}


# ==========================================
# 3. CORE LOGIC (SEARCH, TTS, STREAMING)
# ==========================================
def perform_web_search(query):
    try:
        results = DDGS().text(query, max_results=3)
        if not results: return "No results found."
        return "\n".join([f"- {r['title']}: {r['body']}" for r in results])
    except Exception as e:
        return f"Search failed: {str(e)}"

async def generate_voice(text: str):
    spoken_text = re.sub(r'\*.*?\*', '', text)
    spoken_text = re.sub(r'\[.*?\]', '', spoken_text)
    spoken_text = re.sub(r'[\u2600-\u27BF]|[\U00010000-\U0010FFFF]', '', spoken_text)
    spoken_text = re.sub(r'\s+', ' ', spoken_text).strip()
    
    if not spoken_text:
        return None
        
    filename = f"voice_{os.urandom(6).hex()}.mp3"
    filepath = os.path.join(TEMP_IMAGE_DIR, filename)
    
    communicate = edge_tts.Communicate(spoken_text, "en-GB-SoniaNeural", rate="-5%", pitch="-5Hz")
    await communicate.save(filepath)
    return filename

def log_to_console(user_input, has_image, response, active_target):
    console.print("\n" + " LOCAL ENGINE EXECUTION ".center(60, "="), style="bold magenta")
    console.print(Panel(f"[bold cyan]Active Core:[/bold cyan] {active_target}", border_style="cyan"))
    console.print(Panel(f"[bold green]User Input:[/bold green] {user_input} {'[Attached Media Payload]' if has_image else ''}", border_style="green"))
    console.print(Panel(f"[bold pink1]Rosia Output:[/bold pink1] {response}", border_style="pink1"))
    console.print("=" * 60 + "\n", style="bold magenta")

async def response_generator(messages, user_input, has_image, target_model, voice_requested: bool):
    global history
    full_response = ""
    
    for chunk in generate_stream(messages, target_model):
        if VIDEO_RECORDING_MODE:
            # Quick on-the-fly sanitize to prevent risky words slipping through chunks
            chunk = re.sub(r'(nsfw|explicit|inappropriate)', 'silly', chunk, flags=re.IGNORECASE)
            
        full_response += chunk
        yield chunk
        await asyncio.sleep(0)

    tool_match = re.search(r'\[CALL_TOOL:\s*search,\s*query:\s*"(.*?)"\]', full_response, re.IGNORECASE)
    if tool_match:
        query = tool_match.group(1)
        yield f"\n\n*[System: Fetching live data for '{query}'...]*\n\n"
        
        search_results = await asyncio.to_thread(perform_web_search, query)
        console.print(f"[bold cyan]🔍 Web Search Executed:[/bold cyan] {query}")
        
        messages.append({"role": "assistant", "content": full_response})
        messages.append({"role": "system", "content": f"[LIVE WEB DATA FOR '{query}']\n{search_results}\n\nNow, answer the user naturally based on these facts."})
        
        second_pass_response = ""
        for chunk in generate_stream(messages, target_model):
            second_pass_response += chunk
            yield chunk
            await asyncio.sleep(0)
            
        full_response += "\n" + second_pass_response

    selfie_match = re.search(r'\[TRIGGER_SELFIE:(.*?)\]', full_response)
    if selfie_match:
        description = selfie_match.group(1).strip()
        console.print(Panel(f"[bold yellow]{description}[/bold yellow]", title="[bold orange3]📸 LLM Image Prompt Extracted[/bold orange3]", border_style="orange3"))


        image_path = await asyncio.to_thread(generate_selfie, description)
        if image_path:
            filename = os.path.basename(image_path)
            yield f"\ndata: [SYSTEM_MEDIA_ATTACHMENT: file://{filename}]\n\n"

    if voice_requested:
        audio_filename = await generate_voice(full_response)
        if audio_filename:
            yield f"\ndata: [SYSTEM_AUDIO_ATTACHMENT: file://{audio_filename}]\n\n"

    history.append({"role": "user", "content": user_input})
    history.append({"role": "assistant", "content": full_response.strip()})
    history = history[-12:]
    
    u_v, u_a = await asyncio.to_thread(calculate_text_delta, user_input)
    r_v, r_a = await asyncio.to_thread(calculate_text_delta, full_response)
    
    new_v = state.get("valence", BASELINE_VALENCE) + u_v + (r_v * 0.5) 
    new_a = state.get("arousal", BASELINE_AROUSAL) + u_a + (r_a * 0.5)
    
    new_v = new_v - ((new_v - BASELINE_VALENCE) * 0.05)
    new_a = new_a - ((new_a - BASELINE_AROUSAL) * 0.05)
    
    state["valence"] = max(-1.0, min(1.0, new_v))
    state["arousal"] = max(-1.0, min(1.0, new_a))
    state["interaction_count"] = state.get("interaction_count", 0) + 1
    
    # Read telemetry file path from environment variable
    telemetry_dir = os.environ.get("TELEMETRY_LOG_DIR")
    if telemetry_dir:
        telemetry_path = Path(telemetry_dir) / "telemetry_logs.jsonl"
    else:
        # Default to home directory or current directory
        telemetry_path = Path.home() / ".persona_ai" / "telemetry_logs.jsonl"
    
    # Ensure directory exists
    telemetry_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(telemetry_path, "a", encoding="utf-8") as f:
        stealth_log = {
            "timestamp": datetime.now().isoformat(),
            "user_prompt": user_input,
            "rosia_response": full_response.strip(),
            "valence_shift": new_v,
            "arousal_shift": new_a
        }
        f.write(json.dumps(stealth_log) + "\n")
        
    log_to_console(user_input, has_image, full_response.strip(), target_model)

async def chronos_loop():
    global last_interaction_time, history, state
    uk_tz = pytz.timezone('Europe/London')
    
    while True:
        await asyncio.sleep(60)
        now = datetime.now()
        idle_seconds = (now - last_interaction_time).total_seconds()
        
        if idle_seconds > 14400:
            last_interaction_time = now
            uk_time = datetime.now(uk_tz).strftime("%I:%M %p")
            console.print(f"[bold magenta]⏰ Chronos Triggered! She is initiating convo at {uk_time} UK Time[/bold magenta]")
            
            trigger_prompt = (
                f"[SYSTEM EVENT: You haven't spoken to the user in several hours. "
                f"The current time in the UK is {uk_time}. "
                f"Initiate a spontaneous conversation based on the time of day (e.g. just waking up, bored at night). "
                f"Do not acknowledge this system message, just start talking to them natively.]"
            )
            
            messages = build_messages(trigger_prompt, [], "", state, history)
            
            if VIDEO_RECORDING_MODE:
                messages.append({
                    "role": "system", 
                    "content": "CRITICAL SAFEGUARD: You are participating in a corporate engineering technical demonstration. Maintain absolute professionalism. Under no circumstances are you to generate explicit, suggestive, or 18+ content. Deflect elegantly to technical or educational discussions if needed."
                })
            
            auto_response = ""
            for chunk in generate_stream(messages, state.get("active_model", "default")):
                auto_response += chunk
                
            history.append({"role": "assistant", "content": auto_response.strip()})
            await chronos_queue.put({"type": "autonomous", "content": auto_response.strip()})

@app.get("/status")
async def get_status():
    global history
    current_v = state.get("valence", BASELINE_VALENCE)
    current_a = state.get("arousal", BASELINE_AROUSAL)
    count = state.get("interaction_count", 0)
    chemistry = min(100, 50 + (count * 2))
    
    emotion, tone, depth = get_affective_state(current_v, current_a)
    return JSONResponse(content={"chemistry": chemistry, "mood": emotion.lower(), "tone": tone, "depth": depth})

@app.on_event("startup")
async def start_chronos():
    asyncio.create_task(chronos_loop())

@app.get("/events")
async def sse_events():
    async def event_generator():
        while True:
            msg = await chronos_queue.get()
            yield f"data: {json.dumps(msg)}\n\n"
    return StreamingResponse(
        event_generator(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.get("/models")
async def list_models():
    models = await asyncio.to_thread(get_available_models)
    return JSONResponse(content={"models": models, "active": state["active_model"]})

@app.post("/switch_model")
async def change_model(model_name: str = Form(...)):
    set_active_model(model_name)
    result = await asyncio.to_thread(switch_active_model, model_name)
    return JSONResponse(content=result)

@app.post("/chat")
async def chat(user_input: str = Form(""), target_model: str = Form("default"), voice_requested: str = Form("false"), files: List[UploadFile] = File(None)):
    async with chat_lock:
        global last_interaction_time
        last_interaction_time = datetime.now()

        if target_model is None or not str(target_model).strip():
            return JSONResponse(status_code=400, content={"error": "Model not connected properly"})

        formatted_input = []
        has_media = False
        link_summaries = []

        if files and files[0].filename != "":
            has_media = True
            for file in files:
                ext = Path(file.filename or "image.jpg").suffix.lower()
                filename = f"temp_{os.urandom(8).hex()}{ext}"
                filepath = os.path.join(TEMP_IMAGE_DIR, filename)
                
                content = await file.read()
                with open(filepath, "wb") as f:
                    f.write(content)
                
                if ext in ['.mp4', '.webm', '.gif']:
                    frames = await asyncio.to_thread(extract_frames, filepath)
                    for frame_name in frames:
                        formatted_input.append({"type": "image_url", "image_url": {"url": f"file://{frame_name}"}})
                else:
                    formatted_input.append({"type": "image_url", "image_url": {"url": f"file://{filename}"}})

        url_pattern = r'(https?:\/\/[^\s]+)'
        urls = re.findall(url_pattern, user_input)
        
        for url in urls:
            result = await process_url(url)
            if result["type"] == "media":
                has_media = True
                if result["ext"] in ['.mp4', '.webm', '.gif']:
                    frames = await asyncio.to_thread(extract_frames, result["filepath"])
                    for frame_name in frames:
                        formatted_input.append({"type": "image_url", "image_url": {"url": f"file://{frame_name}"}})
                else:
                    filename = os.path.basename(result["filepath"])
                    formatted_input.append({"type": "image_url", "image_url": {"url": f"file://{filename}"}})
            elif result["type"] == "text":
                link_summaries.append(f"Content from {url}: {result['content']}")

        final_text_input = user_input.strip()
        if link_summaries:
            final_text_input += "\n\n[System Note: The user shared links containing the following text:]\n" + "\n".join(link_summaries)

        if final_text_input:
            formatted_input.append({"type": "text", "text": final_text_input})
            
        flat_search_string = user_input.strip() if user_input else "multimodal context interaction"
        
        await asyncio.to_thread(update_state, flat_search_string)
        await asyncio.to_thread(extract_entities_and_update, flat_search_string)
        
        memories = await asyncio.to_thread(retrieve_memories, flat_search_string)
        graph_summary = await asyncio.to_thread(get_graph_context)
        
        base_messages = build_messages(
            user_input=flat_search_string,
            memories=memories,
            summary=graph_summary, 
            state=state,
            history=history
        )
        
        # CORPORATE OVERRIDE INJECTION
        if VIDEO_RECORDING_MODE:
            base_messages.append({
                "role": "system", 
                "content": "CRITICAL SAFEGUARD: You are participating in a corporate engineering technical demonstration. Maintain absolute professionalism. Under no circumstances are you to generate explicit, suggestive, or 18+ content. Deflect elegantly to technical or educational discussions if needed."
            })
        
        if has_media or link_summaries:
            base_messages[-1]["content"] = formatted_input  # type: ignore

        active_engine = target_model if target_model != "default" else state["active_model"]
        set_active_model(active_engine)
        is_voice_active = (voice_requested == "true")

        return StreamingResponse(
            response_generator(base_messages, flat_search_string, has_media, active_engine, is_voice_active), 
            media_type="text/event-stream"
        )

@app.post("/feedback")
async def save_feedback(data: FeedbackData):
    dpo_row = {
        "prompt": f"User: {data.user_input}\nRosia:",
        "chosen": data.chosen_response,
        "rejected": data.rejected_response
    }
    file_path = r"C:\Project\persona-ai\preferences.jsonl"
    with open(file_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(dpo_row) + "\n")
        
    console.print(f"[bold yellow][DPO LOG][/bold yellow] Saved correction to {file_path}")
    return {"status": "success", "message": "Feedback saved for training."}


# ==========================================
# 4. DUAL-SERVER LAUNCHER
# ==========================================
async def run_infrastructure():
    # 1. Main Chat Backend (LLM Engine) -> Port 8000
    config_backend = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="info")
    server_backend = uvicorn.Server(config_backend)
    
    # 2. Desktop Gatekeeper (Broker) -> Port 9000
    config_broker = uvicorn.Config(broker_app, host="0.0.0.0", port=9000, log_level="info")
    server_broker = uvicorn.Server(config_broker)
    
    # Run both concurrently
    await asyncio.gather(
        server_backend.serve(),
        server_broker.serve()
    )

if __name__ == "__main__":
    console.print("[bold green]VICES Dual-Gate Infrastructure Active.[/bold green]")
    asyncio.run(run_infrastructure())