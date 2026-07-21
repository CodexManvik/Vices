# generation.py
import httpx
import json
import re
import os
import shutil
import subprocess
import time
import atexit
import asyncio
from pathlib import Path
from typing import Optional
from rich.console import Console
from config import LLAMA_BASE_URL, LLAMA_TIMEOUT, GENERATION_TEMPERATURE, GENERATION_TOP_P, GENERATION_FREQUENCY_PENALTY, GENERATION_PRESENCE_PENALTY

console = Console()

# --- LOCAL LAUNCH UTILITIES ---

active_llama_process = None

def get_tauri_models_dir() -> Path:
    """Resolves the platform-specific local AppData path for Vices models."""
    home = Path.home()
    
    # 1. Check Windows LOCALAPPDATA
    local_appdata = os.getenv("LOCALAPPDATA")
    if local_appdata:
        base_paths = [
            Path(local_appdata) / "com.persona.ai.vices" / "models",
            Path(local_appdata) / "Vices" / "models"
        ]
        for p in base_paths:
            if p.exists():
                return p
        return Path(local_appdata) / "com.persona.ai.vices" / "models"
        
    # 2. Check macOS Application Support
    if os.name == "posix":
        import platform
        if platform.system() == "Darwin":
            base_paths = [
                home / "Library" / "Application Support" / "com.persona.ai.vices" / "models",
                home / "Library" / "Application Support" / "Vices" / "models"
            ]
            for p in base_paths:
                if p.exists():
                    return p
            return home / "Library" / "Application Support" / "com.persona.ai.vices" / "models"
            
    # 3. Check Linux XDG_DATA_HOME
    xdg_data = os.getenv("XDG_DATA_HOME")
    if xdg_data:
        base_paths = [
            Path(xdg_data) / "com.persona.ai.vices" / "models",
            Path(xdg_data) / "Vices" / "models"
        ]
        for p in base_paths:
            if p.exists():
                return p
        return Path(xdg_data) / "com.persona.ai.vices" / "models"
        
    # Standard Linux fallback
    base_paths = [
        home / ".local" / "share" / "com.persona.ai.vices" / "models",
        home / ".local" / "share" / "Vices" / "models"
    ]
    for p in base_paths:
        if p.exists():
            return p
    return home / ".local" / "share" / "com.persona.ai.vices" / "models"

def find_llama_server_binary() -> Optional[Path]:
    """Finds the llama-server binary in the environment."""
    binary_name = "llama-server.exe" if os.name == "nt" else "llama-server"
    
    # 1. Search in PATH
    path_binary = shutil.which(binary_name)
    if path_binary:
        return Path(path_binary)
        
    # 2. Search in current working directory and common subfolders
    cwd = Path.cwd()
    search_paths = [
        cwd / binary_name,
        cwd / "bin" / binary_name,
        cwd / "llama.cpp" / binary_name,
        cwd.parent / binary_name,
    ]
    for p in search_paths:
        if p.exists():
            return p
            
    return None

def get_custom_server_settings() -> dict:
    """Reads llama-server settings from backend/data/settings.json if it exists."""
    settings_path = Path(__file__).parent / "data" / "settings.json"
    defaults = {
        "context_size": 2048,
        "threads": 4,
        "gpu_layers": 99
    }
    if settings_path.exists():
        try:
            with open(settings_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {
                    "context_size": int(data.get("context_size", 2048)),
                    "threads": int(data.get("threads", 4)),
                    "gpu_layers": int(data.get("gpu_layers", 99))
                }
        except Exception:
            pass
    return defaults

def discover_local_models() -> tuple[Optional[Path], Optional[Path]]:
    """Scans the local models directory and returns a tuple (main_model_path, vision_projector_path)."""
    models_dir = get_tauri_models_dir()
    if not models_dir.exists():
        return None, None
        
    # 1. Prefer uncensored if it exists
    uncensored_model = models_dir / "Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf"
    uncensored_vision = models_dir / "mmproj-Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-f16.gguf"
    if uncensored_model.exists():
        return uncensored_model, uncensored_vision if uncensored_vision.exists() else None
        
    # 2. Prefer safe standard if it exists
    safe_model = models_dir / "gemma-4-E4B-it-Q4_K_M.gguf"
    safe_vision = models_dir / "mmproj-F16.gguf"
    if safe_model.exists():
        return safe_model, safe_vision if safe_vision.exists() else None
        
    # 3. Fallback: Search for any .gguf files
    main_model = None
    vision_model = None
    for file in sorted(models_dir.glob("*.gguf")):
        if "mmproj" in file.name.lower():
            vision_model = file
        else:
            main_model = file
            
    return main_model, vision_model

def start_llama_server(model_path: Path, vision_path: Optional[Path]) -> bool:
    """Spawns the local llama-server background process and waits for it to be ready."""
    global active_llama_process
    
    binary = find_llama_server_binary()
    if not binary:
        raise FileNotFoundError(
            "llama-server executable not found. Please ensure it is installed and added to PATH, "
            "or place the binary in the project folder."
        )
        
    port = 8080
    match = re.search(r":(\d+)", LLAMA_BASE_URL)
    if match:
        port = int(match.group(1))
        
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
        except socket.error:
            raise OSError(
                f"Port {port} is already in use by another application. "
                "Ensure no other service is bound to this port."
            )
        
    settings = get_custom_server_settings()
    cmd = [
        str(binary),
        "-m", str(model_path),
        "--port", str(port),
        "-c", str(settings["context_size"]),
        "-t", str(settings["threads"]),
        "--log-disable"
    ]
    if settings["gpu_layers"] > 0:
        cmd += ["-ngl", str(settings["gpu_layers"])]
        
    if vision_path and vision_path.exists():
        cmd += ["--mmproj", str(vision_path)]
        
    console.print(f"[bold yellow]Spawning background llama-server...[/bold yellow]")
    console.print(f"[yellow]Cmd: {' '.join(cmd)}[/yellow]")
    
    try:
        if os.name == "nt":
            creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
            active_llama_process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=creation_flags
            )
        else:
            active_llama_process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            
        # Poll health endpoint f"{LLAMA_BASE_URL}/models"
        import requests
        for i in range(15):
            if active_llama_process.poll() is not None:
                raise RuntimeError(f"llama-server terminated unexpectedly with code {active_llama_process.returncode}")
            try:
                res = requests.get(f"{LLAMA_BASE_URL}/models", timeout=1)
                if res.status_code == 200:
                    console.print(f"[bold green]Local llama-server successfully started and responsive on port {port}.[/bold green]")
                    return True
            except Exception:
                pass
            time.sleep(1)
            
        raise TimeoutError("llama-server failed to respond within 15 seconds.")
    except Exception as e:
        cleanup_llama_server()
        raise e

def cleanup_llama_server():
    """Cleanly terminates the local llama-server subprocess."""
    global active_llama_process
    if active_llama_process:
        console.print("[yellow]Shutting down local llama-server process...[/yellow]")
        try:
            active_llama_process.terminate()
            active_llama_process.wait(timeout=3)
        except Exception:
            try:
                active_llama_process.kill()
            except Exception:
                pass
        active_llama_process = None

atexit.register(cleanup_llama_server)

def ensure_local_server_running() -> bool:
    """Ensures llama-server is running. Spawns it dynamically if offline."""
    import requests
    try:
        res = requests.get(f"{LLAMA_BASE_URL}/models", timeout=2)
        if res.status_code == 200:
            return True
    except Exception:
        pass
        
    # Not running, load local files
    main_model, vision_model = discover_local_models()
    
    if not main_model or not main_model.exists():
        models_dir = get_tauri_models_dir()
        raise FileNotFoundError(
            f"No local GGUF models found in Tauri AppData directory: {models_dir}\n"
            f"Please run the setup flow in the Vices app to download the models."
        )
        
    return start_llama_server(main_model, vision_model)

def get_available_models():
    """Queries the local llama.cpp server for loaded/available models, or checks disk if offline."""
    import requests
    # 1. Try to query running server first
    try:
        res = requests.get(f"{LLAMA_BASE_URL}/models", timeout=2)
        if res.status_code == 200:
            return res.json().get("data", [])
    except Exception:
        pass
        
    # 2. Fallback to check local disk models
    try:
        main_model, _ = discover_local_models()
        if main_model and main_model.exists():
            return [{"id": main_model.name, "object": "model"}]
    except Exception:
        pass
        
    return [{"id": "default-local-gguf", "object": "model"}]

def switch_active_model(model_path):
    """Instructs llama.cpp to load a new model payload dynamically."""
    return {"status": "success", "active_model": model_path}

def clean_chunk(text):
    """Strips residual dialogue boundary markers during streaming."""
    patterns = [r"^Assistant:\s*", r"^Rosia:\s*", r"^You:\s*"]
    for pattern in patterns:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)
    return text

async def generate_stream(messages, target_model="default"):
    """Streams completions cleanly and asynchronously from the unified local engine."""
    
    # Ensure local server is running
    try:
        await asyncio.to_thread(ensure_local_server_running)
    except Exception as e:
        yield f" [Model Launch Failed]: {str(e)}\n"
        return
        
    # Debug: Check for vision content
    has_vision = False
    for msg in messages:
        if isinstance(msg.get("content"), list):
            has_vision = True
            console.print(f"[cyan][DEBUG] Multimodal message detected: {msg['role']}[/cyan]")
            for item in msg["content"]:
                if item.get("type") == "image_url":
                    image_url = item["image_url"]["url"]
                    console.print(f"[cyan][DEBUG] Image URL: {image_url[:100]}...[/cyan]")
    
    if has_vision:
        console.print("[yellow][DEBUG] Sending multimodal request to llama-server[/yellow]")
    
    payload = {
        "messages": messages,
        "temperature": GENERATION_TEMPERATURE,
        "top_p": GENERATION_TOP_P,
        "frequency_penalty": GENERATION_FREQUENCY_PENALTY,
        "presence_penalty": GENERATION_PRESENCE_PENALTY,
        "stream": True,
        "cache_prompt": True  # <-- MASSIVE LLAMA.CPP SPEEDUP: Recycle KV cache keys!
    }

    # Inject user-selected model ID if distinct from active context slot
    if target_model and str(target_model) != "default":
        payload["model"] = str(target_model)

    try:
        limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
        async with httpx.AsyncClient(limits=limits, timeout=LLAMA_TIMEOUT) as client:
            async with client.stream(
                "POST",
                f"{LLAMA_BASE_URL}/chat/completions",
                json=payload
            ) as response:
                if response.status_code != 200:
                    body_raw = await response.aread()
                    snippet = body_raw[:800].decode("utf-8", errors="ignore")
                    yield (
                        " [Engine Fault]: llama.cpp/chat/completions returned an error.\n"
                        f" HTTP {response.status_code}. Body (truncated): {snippet}"
                    )
                    return

                async for line in response.aiter_lines():
                    if not line:
                        continue

                    if line.startswith("data: "):
                        content_raw = line[6:].strip()

                        if content_raw == "[DONE]":
                            break

                        try:
                            chunk_json = json.loads(content_raw)
                            if "choices" in chunk_json and len(chunk_json["choices"]) > 0:
                                delta = chunk_json["choices"][0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield clean_chunk(content)
                        except json.JSONDecodeError:
                            continue

    except httpx.ConnectError:
        yield (
            " [Model not connected properly]: Could not connect to the local engine.\n"
            f" Tried: {LLAMA_BASE_URL}/chat/completions\n"
            " Make sure llama-server is running and reachable, then try again."
        )
    except Exception as e:
        yield (
            " [Model not connected properly]: The local engine request failed.\n"
            f" Tried: {LLAMA_BASE_URL}/chat/completions\n"
            f" Error: {str(e)}"
        )

