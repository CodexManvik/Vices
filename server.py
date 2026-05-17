# server.py
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import List
import asyncio
import os
import tempfile
import re
from pathlib import Path
from pydantic import BaseModel
import json

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

# NEW: Cognitive Emotion Engine
from emotion_engine import calculate_text_delta, get_affective_state, BASELINE_VALENCE, BASELINE_AROUSAL

# UI Terminal Formatting
from rich.console import Console
from rich.panel import Panel

app = FastAPI()
chat_lock = asyncio.Lock()
console = Console()

class FeedbackData(BaseModel):
    user_input: str
    rejected_response: str
    chosen_response: str

app.mount("/images", StaticFiles(directory=TEMP_IMAGE_DIR), name="images")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

history = []

# --- TTS GENERATION LOGIC ---
async def generate_voice(text: str):
    # 1. Strip out roleplay actions (e.g., *smiles*) and system tags
    spoken_text = re.sub(r'\*.*?\*', '', text)
    spoken_text = re.sub(r'\[.*?\]', '', spoken_text)
    
    # 2. Strip out emojis to prevent TTS stuttering
    spoken_text = re.sub(r'[\u2600-\u27BF]|[\U00010000-\U0010FFFF]', '', spoken_text)
    
    # 3. Clean up any double spaces left behind by deleted characters
    spoken_text = re.sub(r'\s+', ' ', spoken_text).strip()
    
    if not spoken_text:
        return None
        
    filename = f"voice_{os.urandom(6).hex()}.mp3"
    filepath = os.path.join(TEMP_IMAGE_DIR, filename)
    
    # SoniaNeural is a soft, highly realistic voice. Lower pitch/rate slightly for intimacy.
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
        full_response += chunk
        yield chunk
        await asyncio.sleep(0)

    # 1. Process Images
    selfie_match = re.search(r'\[TRIGGER_SELFIE:(.*?)\]', full_response)
    if selfie_match:
        description = selfie_match.group(1).strip()
        console.print(Panel(f"[bold yellow]{description}[/bold yellow]", title="[bold orange3]📸 LLM Image Prompt Extracted[/bold orange3]", border_style="orange3"))
        
        image_path = await asyncio.to_thread(generate_selfie, description)
        if image_path:
            filename = os.path.basename(image_path)
            yield f"\ndata: [SYSTEM_MEDIA_ATTACHMENT: file://{filename}]\n\n"

    # 2. Process Voice Audio Only If Toggled On By Frontend
    if voice_requested:
        audio_filename = await generate_voice(full_response)
        if audio_filename:
            yield f"\ndata: [SYSTEM_AUDIO_ATTACHMENT: file://{audio_filename}]\n\n"

    # Save to history
    history.append({"role": "user", "content": user_input})
    history.append({"role": "assistant", "content": full_response.strip()})
    history = history[-12:]
    
    # --- ASYNC NEURAL EMOTION DELTAS ---
    # We run the tiny CPU LLM in the background so it doesn't freeze the server
    u_v, u_a = await asyncio.to_thread(calculate_text_delta, user_input)
    r_v, r_a = await asyncio.to_thread(calculate_text_delta, full_response)
    
    # Add to current state
    new_v = state.get("valence", BASELINE_VALENCE) + u_v + (r_v * 0.5) 
    new_a = state.get("arousal", BASELINE_AROUSAL) + u_a + (r_a * 0.5)
    
    # Apply a tiny 5% decay back toward baseline so she naturally calms down over time
    new_v = new_v - ((new_v - BASELINE_VALENCE) * 0.05)
    new_a = new_a - ((new_a - BASELINE_AROUSAL) * 0.05)
    
    # Clamp to [-1.0, 1.0] limits and save to global state
    state["valence"] = max(-1.0, min(1.0, new_v))
    state["arousal"] = max(-1.0, min(1.0, new_a))
    state["interaction_count"] = state.get("interaction_count", 0) + 1
    # -----------------------------------
    
    log_to_console(user_input, has_image, full_response.strip(), target_model)

@app.get("/status")
async def get_status():
    global history
    
    # Pull dynamic coordinates generated by the 0.5B model
    current_v = state.get("valence", BASELINE_VALENCE)
    current_a = state.get("arousal", BASELINE_AROUSAL)
    
    count = state.get("interaction_count", 0)
    chemistry = min(100, 50 + (count * 2))
    
    # Convert math to UI strings
    emotion, tone, depth = get_affective_state(current_v, current_a)
            
    return JSONResponse(content={"chemistry": chemistry, "mood": emotion.lower(), "tone": tone, "depth": depth})

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
    """Saves corrections to a local JSONL file for future DPO fine-tuning."""
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

if __name__ == "__main__":
    import uvicorn
    console.print("[bold green]Unified Llama.cpp Host Core Active. Listening on Port 8000[/bold green]")
    uvicorn.run(app, host="0.0.0.0", port=8000)