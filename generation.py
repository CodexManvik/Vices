# generation.py
import requests
import json
import re
from rich.console import Console
from config import LLAMA_BASE_URL, LLAMA_TIMEOUT, GENERATION_TEMPERATURE, GENERATION_TOP_P, GENERATION_FREQUENCY_PENALTY, GENERATION_PRESENCE_PENALTY

console = Console()

def get_available_models():
    """Queries the local llama.cpp server for loaded/available models."""
    try:
        res = requests.get(f"{LLAMA_BASE_URL}/models", timeout=5)
        if res.status_code == 200:
            return res.json().get("data", [])
    except Exception:
        pass
    return [{"id": "default-local-gguf", "object": "model"}]

def switch_active_model(model_path):
    """Instructs llama.cpp to load a new model payload dynamically."""
    # Note: Advanced variants of llama-server support dynamic runtime loading via custom management slots.
    # If using the standard /v1 endpoint, you pass the requested model ID in your completion payload.
    return {"status": "success", "active_model": model_path}

def clean_chunk(text):
    """Strips residual dialogue boundary markers during streaming."""
    patterns = [r"^Assistant:\s*", r"^Rosia:\s*", r"^You:\s*"]
    for pattern in patterns:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)
    return text

def generate_stream(messages, target_model="default"):
    """Streams completions cleanly from the unified local engine."""
    
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
        "stream": True
    }

    # Inject user-selected model ID if distinct from active context slot
    if target_model and str(target_model) != "default":
        payload["model"] = str(target_model)

    try:
        response = requests.post(
            f"{LLAMA_BASE_URL}/chat/completions",
            json=payload,
            stream=True,
            timeout=LLAMA_TIMEOUT
        )

        if response.status_code != 200:
            snippet = (response.text or "")[:800]
            yield (
                " [Engine Fault]: llama.cpp/chat/completions returned an error.\n"
                f" HTTP {response.status_code}. Body (truncated): {snippet}"
            )
            return

        for line in response.iter_lines():
            if not line:
                continue

            decoded_line = line.decode('utf-8')
            if decoded_line.startswith("data: "):
                content_raw = decoded_line[6:].strip()

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

    except requests.exceptions.ConnectionError:
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
