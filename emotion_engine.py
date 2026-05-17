# emotion_engine.py
import json
import re
from llama_cpp import Llama

# Emotional Baseline (Slightly happy, relatively calm)
BASELINE_VALENCE = 0.20
BASELINE_AROUSAL = 0.10

print("[COGNITIVE CORE] Booting Sub-1B Emotion Engine on CPU...")

# 1. Load the Tiny Model STRICTLY ON CPU (n_gpu_layers=0)
# Make sure to update this path to your downloaded 0.5B or 1B model!
affective_core = Llama(
    model_path=r"C:\AI\models\qwen2-0.5b-instruct\qwen2-0_5b-instruct-q8_0.gguf", 
    n_ctx=512,         # Very small context window to save RAM
    n_gpu_layers=0,    # 0 = CPU ONLY. Protects your RTX 3050!
    n_threads=4,       # Adjust based on your CPU cores
    verbose=False      # Keeps terminal clean
)

def calculate_text_delta(text: str):
    """Feeds the text to the CPU LLM to extract emotional coordinates."""
    if not text.strip():
        return 0.0, 0.0

    prompt = f"""<|im_start|>system
Analyze the emotional tone of the following text and rate it on two scales:
1. Valence: -1.0 (extremely negative/hostile) to +1.0 (extremely positive/affectionate).
2. Arousal: -1.0 (sleepy/bored/calm) to +1.0 (screaming/intense/horny).
Output ONLY valid JSON in this exact format: {{"valence": 0.0, "arousal": 0.0}}<|im_end|>
<|im_start|>user
{text}<|im_end|>
<|im_start|>assistant
"""
    try:
        # Run inference
        response = affective_core(prompt, max_tokens=25, stop=["<|im_end|>"])
        output_text = response['choices'][0]['text'].strip()
        
        # Tiny models sometimes hallucinate text around JSON, so we use regex to extract the payload
        match = re.search(r'\{.*?\}', output_text, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            # Tiny models might output absolute states, but we want DELTAS (shifts)
            # So we scale down the raw output so it shifts her mood smoothly instead of instantly
            v_shift = float(data.get("valence", 0.0)) * 0.15 
            a_shift = float(data.get("arousal", 0.0)) * 0.15
            return v_shift, a_shift
            
    except Exception as e:
        print(f"[AFFECTIVE CORE ERROR] Failed to parse emotion: {e}")
        return 0.0, 0.0 

    return 0.0, 0.0

def get_affective_state(v: float, a: float):
    """Translates the math into a human-readable emotion for the main LLM prompt."""
    if v >= 0 and a >= 0:
        if a > 0.5: return "Excited", "playful", "high"
        if v > 0.5: return "Affectionate", "warm", "deep"
        return "Happy", "engaged", "steady"
        
    elif v >= 0 and a < 0:
        if a < -0.5: return "Sleepy", "soft", "surface"
        return "Cozy", "relaxed", "steady"
        
    elif v < 0 and a >= 0:
        if a > 0.5: return "Angry", "sharp", "deep"
        if v < -0.5: return "Jealous", "cold", "deep"
        return "Annoyed", "guarded", "surface"
        
    elif v < 0 and a < 0:
        if v < -0.5: return "Sad", "distant", "deep"
        return "Bored", "detached", "surface"
        
    return "Neutral", "casual", "surface"