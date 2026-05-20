import json
import os
import re
import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer
from config import (
    BASELINE_VALENCE, BASELINE_AROUSAL, EMOTION_MODEL_DIR,
    EMOTION_TOKENIZER_NAME, EMOTION_CPU_ONLY, EMOTION_DELTA_MULTIPLIER
)

# Emotional Baseline (Slightly happy, relatively calm)
print("[COGNITIVE CORE] Booting SOTA ONNX Emotion Engine on CPU...")

# Point this to a directory holding your converted ONNX weights
try:
    tokenizer = AutoTokenizer.from_pretrained(EMOTION_TOKENIZER_NAME)
    # Lock model executions exclusively onto CPU execution threads to safeguard your primary GPU VRAM boundary
    providers = ['CPUExecutionProvider'] if EMOTION_CPU_ONLY else ['CUDAExecutionProvider', 'CPUExecutionProvider']
    session = ort.InferenceSession(
        os.path.join(EMOTION_MODEL_DIR, "model.onnx") if os.path.isdir(EMOTION_MODEL_DIR) else "models/emotion_roberta_onnx/model.onnx", 
        providers=providers
    )
    print("[COGNITIVE CORE] ONNX classifier session loaded successfully.")
    USING_ONNX = True
except Exception as e:
    print(f"[COGNITIVE CORE ERROR] Failed to load ONNX session: {e}")
    print("[COGNITIVE CORE] Defaulting to zero-delta placeholder modes.")
    USING_ONNX = False

EMOTION_LABELS = ["anger", "disgust", "fear", "joy", "neutral", "sadness", "surprise"]

# Vector mapping table translating categorical classification scores into structural valence-arousal ranges
EMOTION_MAPPING = {
    "joy": {"valence": 0.8, "arousal": 0.4},
    "surprise": {"valence": 0.6, "arousal": 0.6},
    "anger": {"valence": -0.8, "arousal": 0.8},
    "sadness": {"valence": -0.7, "arousal": -0.4},
    "fear": {"valence": -0.5, "arousal": 0.6},
    "disgust": {"valence": -0.6, "arousal": 0.2},
    "neutral": {"valence": 0.0, "arousal": 0.0}
}

def calculate_text_delta(text: str):
    """Feeds incoming text lines to the ONNX encoder to return continuous metric deltas."""
    if not text.strip() or not USING_ONNX:
        return 0.0, 0.0

    try:
        # Tokenize incoming chat log strings
        inputs = tokenizer(text, return_tensors="np", truncation=True, max_length=128)
        
        onnx_inputs = {
            "input_ids": inputs["input_ids"].astype(np.int64),
            "attention_mask": inputs["attention_mask"].astype(np.int64)
        }
        
        if "token_type_ids" in inputs:
            onnx_inputs["token_type_ids"] = inputs["token_type_ids"].astype(np.int64)

        # Run high-speed classification inference pass on CPU
        outputs = session.run(None, onnx_inputs)
        logits = outputs[0][0]
        
        # Softmax evaluation loop
        exp_logits = np.exp(logits - np.max(logits))
        probabilities = exp_logits / exp_logits.sum()
        
        top_index = np.argmax(probabilities)
        dominant_emotion = EMOTION_LABELS[top_index]
        
        # Pull geometric delta target parameters
        coords = EMOTION_MAPPING.get(dominant_emotion, {"valence": 0.0, "arousal": 0.0})
        
        # Maintains your original exact continuous mood shift smoothing scale factor (configurable multiplier)
        v_shift = coords["valence"] * EMOTION_DELTA_MULTIPLIER
        a_shift = coords["arousal"] * EMOTION_DELTA_MULTIPLIER
        
        return v_shift, a_shift
            
    except Exception as e:
        print(f"[AFFECTIVE CORE ERROR] ONNX metrics analysis split failed: {e}")
        return 0.0, 0.0 

def get_affective_state(v: float, a: float):
    """Translates math vectors into context strings injected directly into the core system prompt."""
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