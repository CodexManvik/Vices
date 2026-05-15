# server.py
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import asyncio
import base64
import os
import tempfile
from pathlib import Path

# Local Subsystem Integration
from memory import retrieve_memories
from prompt_builder import build_messages
from generation import generate_stream, get_available_models, switch_active_model
from state import state, update_state, set_active_model
from graph_memory import extract_entities_and_update, get_graph_context

# UI Terminal Formatting
from rich.console import Console
from rich.panel import Panel

app = FastAPI()
chat_lock = asyncio.Lock()
console = Console()

# Create temp directory for images if it doesn't exist
TEMP_IMAGE_DIR = os.path.join(tempfile.gettempdir(), "persona_ai_images")
os.makedirs(TEMP_IMAGE_DIR, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://freeness-gulf-jeep.ngrok-free.dev"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

history = []

def log_to_console(user_input, has_image, response, active_target):
    console.print("\n" + " LOCAL ENGINE EXECUTION ".center(60, "="), style="bold magenta")
    console.print(Panel(f"[bold cyan]Active Core:[/bold cyan] {active_target}", border_style="cyan"))
    console.print(Panel(f"[bold green]User Input:[/bold green] {user_input} {'[Attached Image Payload]' if has_image else ''}", border_style="green"))
    console.print(Panel(f"[bold pink1]Rosia Output:[/bold pink1] {response}", border_style="pink1"))
    console.print("=" * 60 + "\n", style="bold magenta")

async def response_generator(messages, user_input, has_image, target_model):
    global history
    full_response = ""
    
    for chunk in generate_stream(messages, target_model):
        full_response += chunk
        yield chunk
        await asyncio.sleep(0)

    history.append({"role": "user", "content": user_input})
    history.append({"role": "assistant", "content": full_response.strip()})
    history = history[-12:]
    log_to_console(user_input, has_image, full_response.strip(), target_model)

# /vitals endpoint removed (was causing issues when optional hardware monitoring deps are not installed).

@app.get("/status")
async def get_status():
    global history
    chemistry = 50
    mood = "neutral"
    tone = "casual"
    depth = "surface"

    if len(history) > 0:
        from state import state
        # A simple stateful dynamic computation matching persona
        count = state.get("interaction_count", 0)
        chemistry = min(100, 50 + (count * 4))
        
        last_resp = history[-1].get("content", "").lower() if history else ""
        if any(w in last_resp for w in ["moan", "fuck", "soft", "melt", "tight", "handsome"]):
            mood = "intimate"
            tone = "sultry" 
            depth = "deep"
        elif any(w in last_resp for w in ["think", "wonder", "why", "maybe"]):
            mood = "reflective"
            tone = "soft"
            depth = "profound"
        else:
            mood = "engaged"
            tone = "warm"
            depth = "steady"
            
    return JSONResponse(content={
        "chemistry": chemistry,
        "mood": mood,
        "tone": tone,
        "depth": depth
    })

@app.get("/models")
async def list_models():
    """Exposes accessible local architecture models to interface selection menus."""
    models = await asyncio.to_thread(get_available_models)
    return JSONResponse(content={"models": models, "active": state["active_model"]})

@app.post("/switch_model")
async def change_model(model_name: str = Form(...)):
    """Triggers local target weight replacement execution."""
    set_active_model(model_name)
    result = await asyncio.to_thread(switch_active_model, model_name)
    console.print(f"[bold yellow]Runtime Target Updated to: {model_name}[/bold yellow]")
    return JSONResponse(content=result)

@app.post("/chat")
async def chat(user_input: str = Form(""), target_model: str = Form("default"), image: UploadFile = File(None)):
    async with chat_lock:
        if target_model is None or not str(target_model).strip():
            return JSONResponse(
                status_code=400,
                content={
                    "error": "Model not connected properly",
                    "detail": "You provided an empty model id. Start the engine/server and choose a model from /models."
                },
            )

        formatted_input = []
        has_img = False
        image_path = None

        # Native multimodal injection formatting handling for llama.cpp vision models
        if image:
            has_img = True
            img_bytes = await image.read()
            
            # Save image to temporary file for llama-server to access
            ext = Path(image.filename or "image.jpg").suffix or ".jpg"
            filename = f"temp_{os.urandom(8).hex()}{ext}"
            image_path = os.path.join(TEMP_IMAGE_DIR, filename)
            
            with open(image_path, "wb") as f:
                f.write(img_bytes)
            
            # When --media-path is set, send just the filename (relative to media directory)
            file_url = f"file://{filename}"
            
            formatted_input.append({
                "type": "image_url",
                "image_url": {"url": file_url}
            })
            
            console.print(f"[cyan]Image saved to: {image_path}[/cyan]")
            console.print(f"[cyan]Image URL: {file_url}[/cyan]")

        if user_input and user_input.strip():
            formatted_input.append({"type": "text", "text": user_input.strip()})
            
        # Ensure database routing logic matches standard textual query abstractions
        flat_search_string = user_input.strip() if user_input else "multimodal context interaction"
        
        await asyncio.to_thread(update_state, flat_search_string)
        await asyncio.to_thread(extract_entities_and_update, flat_search_string)
        
        memories = await asyncio.to_thread(retrieve_memories, flat_search_string)
        graph_summary = await asyncio.to_thread(get_graph_context)
        
        # Build core system contextual staging frames
        base_messages = build_messages(
            user_input=flat_search_string,
            memories=memories,
            summary=graph_summary, 
            state=state,
            history=history
        )
        
        # Overwrite user entry block with full vision array syntax payload
        if has_img:
            # `content` can be either a string (text-only) or a multimodal array (image+text).
            # Keep runtime behavior identical; this clarifies intent for static type checkers.
            base_messages[-1]["content"] = formatted_input  # type: ignore[assignment]

        # Execute generation tracking directly against specified execution slot
        active_engine = target_model if target_model != "default" else state["active_model"]
        set_active_model(active_engine)

        return StreamingResponse(
            response_generator(base_messages, flat_search_string, has_img, active_engine), 
            media_type="text/event-stream"
        )

if __name__ == "__main__":
    import uvicorn
    console.print("[bold green]Unified Llama.cpp Host Core Active. Listening on Port 8000[/bold green]")
    uvicorn.run(app, host="0.0.0.0", port=8000)
