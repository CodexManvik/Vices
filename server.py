# server.py
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
import asyncio
import os
import uvicorn
import re
from pathlib import Path
from pydantic import BaseModel
import json
from duckduckgo_search import DDGS
from datetime import datetime
import pytz
import uuid
import secrets
from functools import wraps
from socket import gethostbyname, gethostname

# --- CONFIGURATION IMPORTS ---
from config import (
    CORS_ALLOW_ORIGINS, CORS_ALLOW_METHODS, CORS_ALLOW_HEADERS, VIDEO_RECORDING_MODE,
    CURRENT_RUNTIME_TUNNEL, WEB_SEARCH_MAX_RESULTS,
    TEMP_IMAGE_DIR, ADMIN_PASSWORD, REQUEST_STORAGE_PATH, APPROVED_TOKENS_PATH, MASTER_TOKEN
)

# --- VOICE INTEGRATION ---
import edge_tts

# Local Subsystem Integration
from memory import retrieve_memories
from prompt_builder import build_messages
from generation import generate_stream, get_available_models, switch_active_model
from state import state, update_state, set_active_model
from graph_memory import extract_entities_and_update, get_graph_context
from media_handler import process_url, extract_frames
from image_generator import generate_selfie

# Cognitive Emotion Engine
from emotion_engine import calculate_text_delta, get_affective_state, BASELINE_VALENCE, BASELINE_AROUSAL

# UI Terminal Formatting
from rich.console import Console
from rich.panel import Panel

# ==========================================
# APP INIT
# ==========================================

app = FastAPI()
chat_lock = asyncio.Lock()
console = Console()
last_interaction_time = datetime.now()
chronos_queue = asyncio.Queue()
allow_creds = False if "*" in CORS_ALLOW_ORIGINS else True

CALL_TOOL_PATTERN = re.compile(
    r'\[CALL_TOOL:\s*search,\s*query:\s*"(.*?)"\]',
    re.IGNORECASE,
)
SELFIE_PATTERN = re.compile(r'\[TRIGGER_SELFIE:(.*?)\]')
STATUS_SUBSCRIBERS: List[asyncio.Queue] = []

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_methods=CORS_ALLOW_METHODS,
    allow_headers=CORS_ALLOW_HEADERS,
    allow_credentials=allow_creds,
)

app.mount("/images", StaticFiles(directory=TEMP_IMAGE_DIR), name="images")

# ==========================================
# SESSION HISTORY (per-token, not global)
# ==========================================
session_histories: dict[str, list] = {}
chronos_history: list = []
MAX_HISTORY = 12

CHAT_HISTORIES_PATH = Path.home() / ".persona_ai" / "chat_histories.json"


def load_chat_histories():
    global session_histories
    try:
        CHAT_HISTORIES_PATH.parent.mkdir(parents=True, exist_ok=True)
        if CHAT_HISTORIES_PATH.exists():
            with open(CHAT_HISTORIES_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    session_histories.update(loaded)
                    print(f"[Core DB] Loaded {len(session_histories)} persistent chat sessions from disk.")
    except Exception as e:
        print(f"Error loading chat histories: {e}")


def save_chat_histories():
    try:
        CHAT_HISTORIES_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CHAT_HISTORIES_PATH, "w", encoding="utf-8") as f:
            json.dump(session_histories, f, indent=2)
    except Exception as e:
        print(f"Error saving chat histories: {e}")


def get_session_history(token: str) -> list:
    if token not in session_histories:
        session_histories[token] = []
    return session_histories[token]


# ==========================================
# PYDANTIC MODELS
# ==========================================

class FeedbackData(BaseModel):
    user_input: str
    rejected_response: str
    chosen_response: str


class AccessRequest(BaseModel):
    id: str
    name: str
    ip: str
    timestamp: str
    status: str
    token: Optional[str] = None


class RequestWaitlistInput(BaseModel):
    name: str


class CheckApprovalInput(BaseModel):
    request_id: str


class AdminApproveInput(BaseModel):
    request_id: str
    token: Optional[str] = None


class AdminDenyInput(BaseModel):
    request_id: str


class AdminWaitlistInput(BaseModel):
    request_id: str


# ==========================================
# REQUEST STORAGE
# ==========================================

class RequestStorage:
    def __init__(self, storage_path: str):
        self.storage_path = storage_path
        self.requests: dict = {}
        self.load()

    def load(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r") as f:
                    data = json.load(f)
                    self.requests = data.get("requests", {})
            except Exception as e:
                print(f"Error loading request storage: {e}")
                self.requests = {}

    def save(self):
        try:
            with open(self.storage_path, "w") as f:
                json.dump({"requests": self.requests}, f, indent=2)
        except Exception as e:
            print(f"Error saving request storage: {e}")

    def create_request(self, name: str, ip: str) -> AccessRequest:
        request_id = str(uuid.uuid4())
        now = datetime.now(pytz.UTC).isoformat()
        req = {
            "id": request_id,
            "name": name,
            "ip": ip,
            "timestamp": now,
            "status": "pending",
            "token": None,
        }
        self.requests[request_id] = req
        self.save()
        return AccessRequest(**req)

    def get_request(self, request_id: str) -> Optional[AccessRequest]:
        if request_id in self.requests:
            return AccessRequest(**self.requests[request_id])
        return None

    def update_request(
        self, request_id: str, status: str, token: Optional[str] = None
    ) -> Optional[AccessRequest]:
        if request_id in self.requests:
            self.requests[request_id]["status"] = status
            if token:
                self.requests[request_id]["token"] = token
            self.save()
            return AccessRequest(**self.requests[request_id])
        return None

    def get_all_requests(self) -> List[AccessRequest]:
        return [AccessRequest(**req) for req in self.requests.values()]


request_storage = RequestStorage(REQUEST_STORAGE_PATH)


# ==========================================
# HELPERS
# ==========================================

def verify_admin_password(password: str) -> bool:
    return secrets.compare_digest(password or "", ADMIN_PASSWORD)


def get_status_payload() -> dict:
    current_v = state.get("valence", BASELINE_VALENCE)
    current_a = state.get("arousal", BASELINE_AROUSAL)
    count = state.get("interaction_count", 0)
    chemistry = min(100, 50 + (count * 2))
    emotion, tone, depth = get_affective_state(current_v, current_a)
    return {
        "chemistry": chemistry,
        "mood": emotion.lower(),
        "tone": tone,
        "depth": depth,
    }


async def publish_status() -> None:
    payload = json.dumps(get_status_payload())
    for subscriber in STATUS_SUBSCRIBERS.copy():
        try:
            subscriber.put_nowait(payload)
        except Exception:
            continue


def admin_required(func):
    @wraps(func)
    async def wrapper(*args, password: str = Header(None), **kwargs):
        if not password or not secrets.compare_digest(password or "", ADMIN_PASSWORD):
            raise HTTPException(status_code=401, detail="Unauthorized")
        return await func(*args, **kwargs)

    return wrapper


def get_client_ip(x_forwarded_for: Optional[str] = None) -> str:
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    try:
        return gethostbyname(gethostname())
    except Exception:
        return "127.0.0.1"


def is_valid_token(token: str) -> bool:
    """Check token exists in request_storage and is approved."""
    # 1. Developer Bypass
    if token == MASTER_TOKEN:
        return True
        
    # 2. Standard User Check
    return any(
        req.get("token") == token and req.get("status") == "approved"
        for req in request_storage.requests.values()
    )


def get_tester_info(token: str) -> tuple[str, str]:
    """Resolves Name and IP address for the given tester token."""
    if token == MASTER_TOKEN:
        return "Developer (Master)", "127.0.0.1"
    for req in request_storage.requests.values():
        if req.get("token") == token:
            return req.get("name", "Unknown Tester"), req.get("ip", "Unknown IP")
    return "Unknown Tester", "Unknown IP"



# ==========================================
# BROKER APP (port 9000)
# ==========================================

broker_app = FastAPI()

broker_app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_methods=CORS_ALLOW_METHODS,
    allow_headers=CORS_ALLOW_HEADERS,
    allow_credentials=allow_creds,
)


@broker_app.get("/health")
async def broker_health():
    """Health check endpoint - allows clients to verify broker is reachable."""
    return {
        "status": "healthy",
        "message": "Broker is online and accepting connections",
        "broker_port": 9000,
        "api_endpoint": CURRENT_RUNTIME_TUNNEL
    }


@broker_app.options("/health")
async def broker_health_options():
    """Handle preflight requests for health endpoint."""
    return {"ok": True}


@broker_app.post("/request-access")
async def handle_access_request(x_tester_token: str = Header(None)):
    if not x_tester_token:
        raise HTTPException(
            status_code=403, 
            detail="No token provided. Submit an access request first using /request-waitlist."
        )
    if not is_valid_token(x_tester_token):
        raise HTTPException(
            status_code=403, 
            detail="Invalid or unrecognized token. Ensure it's approved by the admin."
        )
    return {
        "status": "allocated", 
        "session_url": CURRENT_RUNTIME_TUNNEL,
        "message": "Access granted. Use the session_url to connect to the API."
    }


@broker_app.get("/resolve-ip")
async def resolve_ip(x_forwarded_for: Optional[str] = Header(None)):
    ip = get_client_ip(x_forwarded_for)
    for req in request_storage.requests.values():
        if req.get("ip") == ip and req.get("status") == "approved":
            return {
                "status": "approved",
                "token": req.get("token"),
                "name": req.get("name"),
                "message": f"Welcome back, {req.get('name')}! Session resolved automatically."
            }
    return {"status": "unknown", "ip": ip}


@broker_app.post("/request-waitlist")
async def request_waitlist(
    data: RequestWaitlistInput, x_forwarded_for: str = Header(None)
):
    try:
        ip = get_client_ip(x_forwarded_for)
        req = request_storage.create_request(data.name, ip)
        return {
            "status": "pending",
            "request_id": req.id,
            "message": "Your request has been submitted. Waiting for approval...",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@broker_app.post("/check-approval")
async def check_approval(data: CheckApprovalInput):
    try:
        req = request_storage.get_request(data.request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Request not found")
        return {
            "status": req.status,
            "token": req.token if req.status == "approved" else None,
            "message": {
                "pending": "Waiting for admin approval...",
                "approved": "Your access has been approved!",
                "denied": "Your request has been denied.",
                "waitlisted": "You're on the waitlist.",
            }.get(req.status, "Unknown status"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@broker_app.get("/admin/requests")
@admin_required
async def admin_get_requests():
    try:
        reqs = request_storage.get_all_requests()
        return {
            "requests": [
                {
                    "id": r.id,
                    "name": r.name,
                    "ip": r.ip,
                    "timestamp": r.timestamp,
                    "status": r.status,
                    "token": r.token,
                }
                for r in reqs
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@broker_app.post("/admin/approve")
@admin_required
async def admin_approve(data: AdminApproveInput):
    try:
        req = request_storage.get_request(data.request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Request not found")
        token = data.token or f"vx_{secrets.token_urlsafe(32)}"
        request_storage.update_request(data.request_id, "approved", token)
        return {
            "status": "approved",
            "request_id": data.request_id,
            "token": token,
            "message": "Request approved successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@broker_app.post("/admin/deny")
@admin_required
async def admin_deny(data: AdminDenyInput):
    try:
        req = request_storage.get_request(data.request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Request not found")
        request_storage.update_request(data.request_id, "denied")
        return {
            "status": "denied",
            "request_id": data.request_id,
            "message": "Request denied successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@broker_app.post("/admin/waitlist")
@admin_required
async def admin_waitlist(data: AdminWaitlistInput):
    try:
        req = request_storage.get_request(data.request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Request not found")
        request_storage.update_request(data.request_id, "waitlisted")
        return {
            "status": "waitlisted",
            "request_id": data.request_id,
            "message": "Request added to waitlist successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# CORE LOGIC
# ==========================================

def perform_web_search(query: str) -> str:
    try:
        results = DDGS().text(query, max_results=WEB_SEARCH_MAX_RESULTS)
        if not results:
            return "No results found."
        return "\n".join([f"- {r['title']}: {r['body']}" for r in results])
    except Exception as e:
        return f"Search failed: {str(e)}"


async def generate_voice(text: str) -> Optional[str]:
    spoken_text = re.sub(r"\*.*?\*", "", text)
    spoken_text = re.sub(r"\[.*?\]", "", spoken_text)
    spoken_text = re.sub(r"[\u2600-\u27BF]|[\U00010000-\U0010FFFF]", "", spoken_text)
    spoken_text = re.sub(r"\s+", " ", spoken_text).strip()

    if not spoken_text:
        return None

    filename = f"voice_{os.urandom(6).hex()}.mp3"
    filepath = os.path.join(TEMP_IMAGE_DIR, filename)
    communicate = edge_tts.Communicate(
        spoken_text, "en-GB-SoniaNeural", rate="-5%", pitch="-5Hz"
    )
    await communicate.save(filepath)
    return filename


def log_to_console(user_input, has_image, response, active_target):
    console.print(
        "\n" + " LOCAL ENGINE EXECUTION ".center(60, "="), style="bold magenta"
    )
    console.print(
        Panel(f"[bold cyan]Active Core:[/bold cyan] {active_target}", border_style="cyan")
    )
    console.print(
        Panel(
            f"[bold green]User Input:[/bold green] {user_input} "
            f"{'[Attached Media Payload]' if has_image else ''}",
            border_style="green",
        )
    )
    console.print(
        Panel(
            f"[bold pink1]Rosia Output:[/bold pink1] {response}",
            border_style="pink1",
        )
    )
    console.print("=" * 60 + "\n", style="bold magenta")


async def response_generator(
    messages,
    user_input,
    has_image,
    target_model,
    voice_requested: bool,
    lock: asyncio.Lock,
    history: list,
    token_key: str = "default",
    client_ip: str = "127.0.0.1",
):
    """
    History is the per-session list passed in by reference — mutated in place.
    """
    full_response = ""

    async for chunk in generate_stream(messages, target_model):
        if VIDEO_RECORDING_MODE:
            chunk = re.sub(
                r"(nsfw|explicit|inappropriate)", "silly", chunk, flags=re.IGNORECASE
            )
        full_response += chunk
        yield chunk
        await asyncio.sleep(0)

    # Web search interception
    tool_match = CALL_TOOL_PATTERN.search(full_response)
    if tool_match:
        query = tool_match.group(1)
        yield f"\n\n*[System: Fetching live data for '{query}'...]*\n\n"

        search_results = await asyncio.to_thread(perform_web_search, query)
        console.print(f"[bold cyan]🔍 Web Search Executed:[/bold cyan] {query}")

        messages.append({"role": "assistant", "content": full_response})
        messages.append(
            {
                "role": "system",
                "content": (
                    f"[LIVE WEB DATA FOR '{query}']\n{search_results}\n\n"
                    "Now, answer the user naturally based on these facts."
                ),
            }
        )

        second_pass = ""
        async for chunk in generate_stream(messages, target_model):
            second_pass += chunk
            yield chunk
            await asyncio.sleep(0)

        full_response += "\n" + second_pass

    # Image generation
    selfie_match = SELFIE_PATTERN.search(full_response)
    if selfie_match:
        description = selfie_match.group(1).strip()
        console.print(
            Panel(
                f"[bold yellow]{description}[/bold yellow]",
                title="[bold orange3]📸 LLM Image Prompt Extracted[/bold orange3]",
                border_style="orange3",
            )
        )
        image_path = await asyncio.to_thread(generate_selfie, description, user_input)
        if image_path:
            filename = os.path.basename(image_path)
            yield f"\ndata: [SYSTEM_MEDIA_ATTACHMENT: file://{filename}]\n\n"

    # Voice
    if voice_requested:
        audio_filename = await generate_voice(full_response)
        if audio_filename:
            yield f"\ndata: [SYSTEM_AUDIO_ATTACHMENT: file://{audio_filename}]\n\n"

    # Update per-session history in place
    history.append({"role": "user", "content": user_input})
    history.append({"role": "assistant", "content": full_response.strip()})
    del history[:-MAX_HISTORY]
    save_chat_histories()

    # Emotion engine update
    u_v, u_a = await asyncio.to_thread(calculate_text_delta, user_input)
    r_v, r_a = await asyncio.to_thread(calculate_text_delta, full_response)

    new_v = state.get("valence", BASELINE_VALENCE) + u_v + (r_v * 0.5)
    new_a = state.get("arousal", BASELINE_AROUSAL) + u_a + (r_a * 0.5)

    # Gentle mean reversion toward baseline
    new_v = new_v - ((new_v - BASELINE_VALENCE) * 0.05)
    new_a = new_a - ((new_a - BASELINE_AROUSAL) * 0.05)

    state["valence"] = max(-1.0, min(1.0, new_v))
    state["arousal"] = max(-1.0, min(1.0, new_a))
    state["interaction_count"] = state.get("interaction_count", 0) + 1

    await publish_status()

    # Telemetry
    telemetry_dir = os.environ.get("TELEMETRY_LOG_DIR")
    telemetry_path = (
        Path(telemetry_dir) / "telemetry_logs.jsonl"
        if telemetry_dir
        else Path.home() / ".persona_ai" / "telemetry_logs.jsonl"
    )
    telemetry_path.parent.mkdir(parents=True, exist_ok=True)

    name, registered_ip = get_tester_info(token_key)
    final_ip = client_ip if client_ip and client_ip != "127.0.0.1" else registered_ip

    with open(telemetry_path, "a", encoding="utf-8") as f:
        f.write(
            json.dumps(
                {
                    "timestamp": datetime.now().isoformat(),
                    "tester_name": name,
                    "tester_ip": final_ip,
                    "user_prompt": user_input,
                    "rosia_response": full_response.strip(),
                    "valence_shift": new_v,
                    "arousal_shift": new_a,
                }
            )
            + "\n"
        )

    log_to_console(user_input, has_image, full_response.strip(), target_model)



async def chronos_loop():
    global last_interaction_time
    uk_tz = pytz.timezone("Europe/London")

    while True:
        await asyncio.sleep(60)
        now = datetime.now()
        idle_seconds = (now - last_interaction_time).total_seconds()

        if idle_seconds > 14400:
            last_interaction_time = now
            uk_time = datetime.now(uk_tz).strftime("%I:%M %p")
            console.print(
                f"[bold magenta]⏰ Chronos Triggered at {uk_time} UK Time[/bold magenta]"
            )

            trigger_prompt = (
                f"[SYSTEM EVENT: You haven't spoken to the user in several hours. "
                f"The current time in the UK is {uk_time}. "
                f"Initiate a spontaneous conversation based on the time of day. "
                f"Do not acknowledge this system message, just start talking natively.]"
            )

            messages = build_messages(trigger_prompt, [], "", state, chronos_history)

            if VIDEO_RECORDING_MODE:
                messages.append(
                    {
                        "role": "system",
                        "content": "CRITICAL SAFEGUARD: Corporate demonstration mode. Maintain professionalism.",
                    }
                )

            auto_response = ""
            for chunk in generate_stream(messages, state.get("active_model", "default")):
                auto_response += chunk

            chronos_history.append({"role": "assistant", "content": auto_response.strip()})
            del chronos_history[:-MAX_HISTORY]

            await chronos_queue.put(
                {"type": "autonomous", "content": auto_response.strip()}
            )


# ==========================================
# MAIN APP ROUTES
# ==========================================

@app.get("/status")
async def get_status():
    return JSONResponse(content=get_status_payload())


@app.get("/status/stream")
async def status_stream():
    queue: asyncio.Queue = asyncio.Queue()
    STATUS_SUBSCRIBERS.append(queue)

    async def event_generator():
        try:
            await queue.put(json.dumps(get_status_payload()))
            while True:
                data = await queue.get()
                yield f"data: {data}\n\n"
        finally:
            if queue in STATUS_SUBSCRIBERS:
                STATUS_SUBSCRIBERS.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.on_event("startup")
async def start_chronos():
    load_chat_histories()
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
            "X-Accel-Buffering": "no",
        },
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
async def chat(
    user_input: str = Form(""),
    target_model: str = Form("default"),
    voice_requested: str = Form("false"),
    conversation_id: str = Form(""),
    files: List[UploadFile] = File(None),
    x_tester_token: str = Header(None),
    x_forwarded_for: Optional[str] = Header(None),
):
    global last_interaction_time
    
    last_interaction_time = datetime.now()

    # Resolve per-session history
    token_key = x_tester_token or "default"
    history_key = f"{token_key}_{conversation_id}" if conversation_id else token_key
    history = get_session_history(history_key)
    
    client_ip = get_client_ip(x_forwarded_for)

    if not target_model or not str(target_model).strip():
        return JSONResponse(
            status_code=400, content={"error": "Model not connected properly"}
        )

    formatted_input = []
    has_media = False
    link_summaries = []

    # Handle file uploads
    if files and files[0].filename != "":
        has_media = True
        for file in files:
            ext = Path(file.filename or "image.jpg").suffix.lower()
            filename = f"temp_{os.urandom(8).hex()}{ext}"
            filepath = os.path.join(TEMP_IMAGE_DIR, filename)

            content = await file.read()
            with open(filepath, "wb") as f:
                f.write(content)

            if ext in [".mp4", ".webm", ".gif"]:
                frames = await asyncio.to_thread(extract_frames, filepath)
                for frame_name in frames:
                    formatted_input.append(
                        {"type": "image_url", "image_url": {"url": f"file://{frame_name}"}}
                    )
            else:
                formatted_input.append(
                    {"type": "image_url", "image_url": {"url": f"file://{filename}"}}
                )

    # Handle URLs in message
    urls = re.findall(r"(https?:\/\/[^\s]+)", user_input)
    for url in urls:
        result = await process_url(url)
        if result["type"] == "media":
            has_media = True
            if result["ext"] in [".mp4", ".webm", ".gif"]:
                frames = await asyncio.to_thread(extract_frames, result["filepath"])
                for frame_name in frames:
                    formatted_input.append(
                        {"type": "image_url", "image_url": {"url": f"file://{frame_name}"}}
                    )
            else:
                fname = os.path.basename(result["filepath"])
                formatted_input.append(
                    {"type": "image_url", "image_url": {"url": f"file://{fname}"}}
                )
        elif result["type"] == "text":
            link_summaries.append(f"Content from {url}: {result['content']}")

    final_text_input = user_input.strip()
    if link_summaries:
        final_text_input += (
            "\n\n[System Note: The user shared links containing the following text:]\n"
            + "\n".join(link_summaries)
        )

    if final_text_input:
        formatted_input.append({"type": "text", "text": final_text_input})

    flat_search_string = (
        user_input.strip() if user_input else "multimodal context interaction"
    )

    # Acquire the lock ONLY during PyTorch vector and semantic operations to safeguard VRAM
    async with chat_lock:
        await asyncio.to_thread(update_state, flat_search_string)
        await asyncio.to_thread(extract_entities_and_update, flat_search_string)
        memories = await asyncio.to_thread(retrieve_memories, flat_search_string)
        graph_summary = await asyncio.to_thread(get_graph_context)

    base_messages = build_messages(
        user_input=flat_search_string,
        memories=memories,
        summary=graph_summary,
        state=state,
        history=history,
    )

    if VIDEO_RECORDING_MODE:
        base_messages.append(
            {
                "role": "system",
                "content": "CRITICAL SAFEGUARD: Corporate engineering demonstration. Maintain absolute professionalism.",
            }
        )

    if has_media or link_summaries:
        base_messages[-1]["content"] = formatted_input  # type: ignore

    active_engine = (
        target_model if target_model != "default" else state["active_model"]
    )
    set_active_model(active_engine)
    is_voice_active = voice_requested == "true"

    return StreamingResponse(
        response_generator(
            base_messages,
            flat_search_string,
            has_media,
            active_engine,
            is_voice_active,
            chat_lock,
            history,      # per-session history passed in
            token_key,
            client_ip,
        ),
        media_type="text/event-stream",
    )


def get_preferences_path() -> Path:
    telemetry_dir = os.environ.get("TELEMETRY_LOG_DIR")
    file_path = (
        Path(telemetry_dir) / "preferences.jsonl"
        if telemetry_dir
        else Path.home() / ".persona_ai" / "preferences.jsonl"
    )
    return file_path


@app.post("/feedback")
async def save_feedback(data: FeedbackData):
    dpo_row = {
        "prompt": f"User: {data.user_input}\nRosia:",
        "chosen": data.chosen_response,
        "rejected": data.rejected_response,
    }

    file_path = get_preferences_path()
    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(dpo_row) + "\n")

    console.print(
        f"[bold yellow][DPO LOG][/bold yellow] Saved correction payload to {file_path}"
    )
    return {"status": "success", "message": "Feedback saved for training."}


class UpdatePreferenceInput(BaseModel):
    index: int
    chosen: str
    rejected: Optional[str] = None
    prompt: Optional[str] = None


@app.get("/admin/preferences")
async def get_preferences(password: str = Header(None)):
    if not password or not secrets.compare_digest(password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    file_path = get_preferences_path()
    if not file_path.exists():
        return {"preferences": []}
        
    preferences = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    preferences.append(json.loads(line.strip()))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading preferences: {str(e)}")
        
    return {"preferences": preferences}


@app.post("/admin/preferences/update")
async def update_preference(data: UpdatePreferenceInput, password: str = Header(None)):
    if not password or not secrets.compare_digest(password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    file_path = get_preferences_path()
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Preferences file not found")
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip()]
            
        if data.index < 0 or data.index >= len(lines):
            raise HTTPException(status_code=400, detail="Invalid preference index")
            
        row = json.loads(lines[data.index])
        row["chosen"] = data.chosen
        if data.rejected is not None:
            row["rejected"] = data.rejected
        if data.prompt is not None:
            row["prompt"] = data.prompt
            
        lines[data.index] = json.dumps(row)
        
        with open(file_path, "w", encoding="utf-8") as f:
            for line in lines:
                f.write(line + "\n")
                
        return {"status": "success", "message": "Preference updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


active_training_process: Optional[asyncio.subprocess.Process] = None
training_logs: List[str] = []


@app.post("/admin/preferences/train")
async def start_training(password: str = Header(None)):
    global active_training_process, training_logs
    if not password or not secrets.compare_digest(password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    if active_training_process and active_training_process.returncode is None:
        return {"status": "running", "message": "Training is already active."}
        
    training_logs = ["Starting DPO Fine-tuning pipeline...\n"]
    
    file_path = get_preferences_path()
    if not file_path.exists() or file_path.stat().st_size == 0:
        raise HTTPException(status_code=400, detail="No preference data available for training.")
        
    try:
        cmd = ["python", "train_dpo.py"]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        active_training_process = process
        
        async def read_logs(proc):
            global training_logs
            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
                decoded_line = line.decode("utf-8")
                training_logs.append(decoded_line)
                if len(training_logs) > 1000:
                    training_logs.pop(0)
            await proc.wait()
            training_logs.append(f"\n[Process Completed with Exit Code {proc.returncode}]")
            
        asyncio.create_task(read_logs(process))
        
        return {"status": "started", "message": "DPO training started in background."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to spawn training process: {str(e)}")


@app.get("/admin/preferences/train/status")
async def get_training_status(password: str = Header(None)):
    global active_training_process, training_logs
    if not password or not secrets.compare_digest(password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    is_active = False
    exit_code = None
    if active_training_process:
        exit_code = active_training_process.returncode
        is_active = (exit_code is None)
        
    return {
        "status": "running" if is_active else "idle",
        "exit_code": exit_code,
        "logs": "".join(training_logs)
    }


# ==========================================
# DUAL-SERVER LAUNCHER
# ==========================================

async def run_infrastructure():
    config_backend = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="info")
    server_backend = uvicorn.Server(config_backend)

    config_broker = uvicorn.Config(
        broker_app, host="0.0.0.0", port=9000, log_level="info"
    )
    server_broker = uvicorn.Server(config_broker)

    await asyncio.gather(
        server_backend.serve(),
        server_broker.serve(),
    )


if __name__ == "__main__":
    console.print("[bold green]VICES Dual-Gate Infrastructure Active.[/bold green]")
    asyncio.run(run_infrastructure())