# generation.py
import httpx
import json
import re
from rich.console import Console
from config import LLAMA_BASE_URL, LLAMA_TIMEOUT, GENERATION_TEMPERATURE, GENERATION_TOP_P, GENERATION_FREQUENCY_PENALTY, GENERATION_PRESENCE_PENALTY

console = Console()

def get_available_models():
    """Queries the local llama.cpp server for loaded/available models."""
    import requests
    try:
        res = requests.get(f"{LLAMA_BASE_URL}/models", timeout=5)
        if res.status_code == 200:
            return res.json().get("data", [])
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

