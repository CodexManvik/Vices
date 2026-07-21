"""
Configuration loader for Persona-AI
Handles all environment variables with sensible defaults
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from root directory
load_dotenv(Path(__file__).parent.parent / ".env")

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ============================================
# 1. MODEL & ENGINE CONFIGURATION
# ============================================
LLAMA_BASE_URL = os.getenv("LLAMA_BASE_URL", "http://127.0.0.1:8080/v1")
LLAMA_TIMEOUT = int(os.getenv("LLAMA_TIMEOUT", "120"))

MODEL_PATH = os.getenv("MODEL_PATH", r"C:\AI\models\realismByStableYogi_sd15V9.safetensors")
IMAGE_GEN_TIMEOUT = int(os.getenv("IMAGE_GEN_TIMEOUT", "60"))

EMOTION_MODEL_DIR = os.getenv("EMOTION_MODEL_DIR", r"C:\AI\models\emotion_roberta_onnx")
EMOTION_TOKENIZER_NAME = os.getenv("EMOTION_TOKENIZER_NAME", "j-hartmann/emotion-english-distilroberta-base")

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
RERANKER_MODEL = os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-base")

DPO_MODEL_NAME = os.getenv("DPO_MODEL_NAME", "unsloth/llama-3-8b-Instruct-bnb-4bit")
DPO_MAX_SEQ_LENGTH = int(os.getenv("DPO_MAX_SEQ_LENGTH", "2048"))
DPO_BATCH_SIZE = int(os.getenv("DPO_BATCH_SIZE", "2"))
DPO_GRADIENT_ACCUMULATION_STEPS = int(os.getenv("DPO_GRADIENT_ACCUMULATION_STEPS", "4"))
DPO_NUM_EPOCHS = int(os.getenv("DPO_NUM_EPOCHS", "3"))
DPO_LEARNING_RATE = float(os.getenv("DPO_LEARNING_RATE", "5e-6"))
DPO_BETA = float(os.getenv("DPO_BETA", "0.1"))

# ============================================
# 2. MEMORY & DATABASE PATHS
# ============================================
TV_INDEX_PATH = os.getenv("TV_INDEX_PATH", str(DATA_DIR / "turbovec_memory.tvim"))
METADATA_PATH = os.getenv("METADATA_PATH", str(DATA_DIR / "memory_metadata.json"))
GRAPH_DATABASE_PATH = os.getenv("GRAPH_DATABASE_PATH", str(DATA_DIR / "lancedb_data" / "relational_graph.json"))
CLASSIFIED_MEMORIES_PATH = os.getenv("CLASSIFIED_MEMORIES_PATH", str(DATA_DIR / "classified_memories.json"))
PERSONALITY_DATASET_PATH = os.getenv("PERSONALITY_DATASET_PATH", str(DATA_DIR / "personality_dataset.json"))
PREFERENCES_PATH = os.getenv("PREFERENCES_PATH", str(DATA_DIR / "preferences.jsonl"))
MEMORY_TELEMETRY_PATH = os.getenv("MEMORY_TELEMETRY_PATH", str(DATA_DIR / "telemetry_logs.jsonl"))

# ============================================
# 3. RETRIEVAL ENGINE PARAMETERS
# ============================================
RETRIEVAL_INITIAL_K = int(os.getenv("RETRIEVAL_INITIAL_K", "8"))
RETRIEVAL_MAX_EXPLICIT_DOCS = int(os.getenv("RETRIEVAL_MAX_EXPLICIT_DOCS", "1"))
RETRIEVAL_FINAL_RETURN_COUNT = int(os.getenv("RETRIEVAL_FINAL_RETURN_COUNT", "3"))
TURBOVEC_BIT_WIDTH = int(os.getenv("TURBOVEC_BIT_WIDTH", "4"))

# ============================================
# 4. GENERATION PARAMETERS
# ============================================
GENERATION_TEMPERATURE = float(os.getenv("GENERATION_TEMPERATURE", "0.85"))
GENERATION_TOP_P = float(os.getenv("GENERATION_TOP_P", "0.9"))
GENERATION_FREQUENCY_PENALTY = float(os.getenv("GENERATION_FREQUENCY_PENALTY", "0.1"))
GENERATION_PRESENCE_PENALTY = float(os.getenv("GENERATION_PRESENCE_PENALTY", "0.1"))
DEFAULT_ACTIVE_MODEL = os.getenv("DEFAULT_ACTIVE_MODEL", "default")

# ============================================
# 5. EMOTIONAL BASELINE STATE
# ============================================
BASELINE_VALENCE = float(os.getenv("BASELINE_VALENCE", "0.20"))
BASELINE_AROUSAL = float(os.getenv("BASELINE_AROUSAL", "0.10"))
EMOTION_DELTA_MULTIPLIER = float(os.getenv("EMOTION_DELTA_MULTIPLIER", "0.15"))

# ============================================
# 6. IMAGE GENERATION CONFIGURATION
# ============================================
TEMP_IMAGE_DIR = os.getenv("TEMP_IMAGE_DIR", "persona_ai_images")
if "{tempdir}" in TEMP_IMAGE_DIR:
    import tempfile
    TEMP_IMAGE_DIR = os.path.join(tempfile.gettempdir(), "persona_ai_images")

IMAGE_BASE_PROMPT = os.getenv(
    "IMAGE_BASE_PROMPT",
    "brown and blonde hair, slim sexy waist, big breasts, big ass, latina skin tone, "
    "RAW photo, analog style, 8k uhd, dslr, soft volumetric lighting, highly detailed, "
    "(masterpiece, best quality:1.2), 1girl, solo, 18yo, realistic skin texture, photorealistic"
)

IMAGE_NEGATIVE_PROMPT = os.getenv(
    "IMAGE_NEGATIVE_PROMPT",
    "(deformed iris, deformed pupils, semi-realistic, cgi, 3d, render, sketch, cartoon, drawing, anime, illustration, painting:1.4), "
    "text, worst quality, low quality, jpeg artifacts, ugly, duplicate, morbid, "
    "mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, "
    "bad anatomy, bad proportions, extra limbs, cloned face, disfigured, missing arms, missing legs, long neck"
)

IMAGE_INFERENCE_STEPS = int(os.getenv("IMAGE_INFERENCE_STEPS", "20"))
IMAGE_GUIDANCE_SCALE = float(os.getenv("IMAGE_GUIDANCE_SCALE", "7.5"))

# ============================================
# 7. MEDIA HANDLING
# ============================================
MEDIA_FRAMES_TO_EXTRACT = int(os.getenv("MEDIA_FRAMES_TO_EXTRACT", "3"))
MEDIA_MAX_TEXT_LENGTH = int(os.getenv("MEDIA_MAX_TEXT_LENGTH", "400"))
MEDIA_EXTENSIONS = os.getenv("MEDIA_EXTENSIONS", ".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm").split(",")

# ============================================
# 8. SERVER CONFIGURATION
# ============================================
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8000"))
_raw_origins = os.getenv("CORS_ALLOW_ORIGINS", "")
CORS_ALLOW_ORIGINS = _raw_origins.split(",") if _raw_origins else ["*"]
CORS_ALLOW_METHODS = os.getenv("CORS_ALLOW_METHODS", "*").split(",")
CORS_ALLOW_HEADERS = os.getenv("CORS_ALLOW_HEADERS", "*").split(",")
VIDEO_RECORDING_MODE = os.getenv("VIDEO_RECORDING_MODE", "false").lower() == "true"
MAX_CONCURRENT_REQUESTS = int(os.getenv("MAX_CONCURRENT_REQUESTS", "1"))

# ============================================
# 9. BROKER/TUNNEL CONFIGURATION
# ============================================
CURRENT_RUNTIME_TUNNEL = os.getenv("CURRENT_RUNTIME_TUNNEL", "http://localhost:8000")
IS_DEVELOPER_PRESENT = os.getenv("IS_DEVELOPER_PRESENT", "true").lower() == "true"
BROKER_PORT = int(os.getenv("BROKER_PORT", "8001"))

# ============================================
# 10. WEB SEARCH CONFIGURATION
# ============================================
WEB_SEARCH_MAX_RESULTS = int(os.getenv("WEB_SEARCH_MAX_RESULTS", "3"))

# ============================================
# 11. CONVERSATION & HISTORY
# ============================================
HISTORY_WINDOW_SIZE = int(os.getenv("HISTORY_WINDOW_SIZE", "12"))
SUMMARY_MESSAGE_WINDOW = int(os.getenv("SUMMARY_MESSAGE_WINDOW", "8"))

# ============================================
# 12. PERSONA CONFIGURATION
# ============================================
BASE_PERSONA_NAME = os.getenv("BASE_PERSONA_NAME", "Rosia")
BASE_PERSONA_AGE = int(os.getenv("BASE_PERSONA_AGE", "18"))
BASE_PERSONA_LOCATION = os.getenv("BASE_PERSONA_LOCATION", "UK")
BASE_PERSONA_VOICE_PLATFORM = os.getenv("BASE_PERSONA_VOICE_PLATFORM", "Discord")
MOOD_DESCRIPTION = os.getenv("MOOD_DESCRIPTION", "sultry, highly personal, unfiltered, and effortlessly direct.")
TIMEZONE = os.getenv("TIMEZONE", "Europe/London")

# ============================================
# 13. CONTENT FILTERING & SAFETY
# ============================================
EXPLICIT_WORDS = os.getenv("EXPLICIT_WORDS", "cum,cock,pussy,fuck,daddy").split(",")
ENABLE_CONTENT_GUARDRAILS = os.getenv("ENABLE_CONTENT_GUARDRAILS", "true").lower() == "true"

# ============================================
# 14. DEBUGGING & LOGGING
# ============================================
DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
TELEMETRY_ENABLED = os.getenv("TELEMETRY_ENABLED", "true").lower() == "true"
TELEMETRY_FLUSH_INTERVAL = int(os.getenv("TELEMETRY_FLUSH_INTERVAL", "60"))

# ============================================
# 15. PERFORMANCE & RESOURCE LIMITS
# ============================================
MAX_VRAM_ALLOCATION = int(os.getenv("MAX_VRAM_ALLOCATION", "4"))
EMOTION_CPU_ONLY = os.getenv("EMOTION_CPU_ONLY", "true").lower() == "true"
ENABLE_GRADIENT_CHECKPOINTING = os.getenv("ENABLE_GRADIENT_CHECKPOINTING", "true").lower() == "true"

# ============================================
# 16. TRAINING & OPTIMIZATION
# ============================================
LORA_RANK = int(os.getenv("LORA_RANK", "16"))
LORA_ALPHA = int(os.getenv("LORA_ALPHA", "16"))
LORA_DROPOUT = float(os.getenv("LORA_DROPOUT", "0"))
OPTIMIZER_TYPE = os.getenv("OPTIMIZER_TYPE", "adamw_8bit")
WARMUP_RATIO = float(os.getenv("WARMUP_RATIO", "0.1"))
TRAINING_OUTPUT_DIR = os.getenv("TRAINING_OUTPUT_DIR", "outputs")
LORA_OUTPUT_PATH = os.getenv("LORA_OUTPUT_PATH", "rosia-dpo-lora")

# ============================================
# 17. GRAPH MEMORY CONFIGURATION
# ============================================
GRAPH_ENTITY_CAREER = os.getenv("GRAPH_ENTITY_CAREER", "internship,startup,code,agent,rag,linux").split(",")
GRAPH_ENTITY_FAMILY = os.getenv("GRAPH_ENTITY_FAMILY", "father,cousin,family,parents").split(",")
GRAPH_ENTITY_LIFESTYLE = os.getenv("GRAPH_ENTITY_LIFESTYLE", "bmw,car,music,gaming,setup").split(",")
GRAPH_MIN_WEIGHT_THRESHOLD = int(os.getenv("GRAPH_MIN_WEIGHT_THRESHOLD", "1"))

# ============================================
# 18. TEXT NORMALIZATION
# ============================================
NORMALIZE_SLANG = os.getenv("NORMALIZE_SLANG", "true").lower() == "true"

# ============================================
# 19. FRONTEND CONFIGURATION (WEB APP)
# ============================================
VITE_API_BASE_URL = os.getenv("VITE_API_BASE_URL", "https://commissioner-twin-submitted-protest.trycloudflare.com")

# ============================================
# 20. FRONTEND APP CONFIGURATION (TAURI DESKTOP)
# ============================================
VITE_BROKER_URL = os.getenv("VITE_BROKER_URL", "http://localhost:9000")
DEV_TUNNEL_URL = os.getenv("DEV_TUNNEL_URL", "http://localhost:8000")

# ============================================
# 21. TAURI DESKTOP APP SETTINGS
# ============================================
TAURI_PRODUCT_NAME = os.getenv("TAURI_PRODUCT_NAME", "Vices")
TAURI_WINDOW_TITLE = os.getenv("TAURI_WINDOW_TITLE", "Vices Core")
TAURI_WINDOW_WIDTH = int(os.getenv("TAURI_WINDOW_WIDTH", "800"))
TAURI_WINDOW_HEIGHT = int(os.getenv("TAURI_WINDOW_HEIGHT", "600"))
VITE_DEV_PORT = int(os.getenv("VITE_DEV_PORT", "5173"))
TAURI_DEV_URL = os.getenv("TAURI_DEV_URL", "http://localhost:5173")
TAURI_API_HOSTS = os.getenv("TAURI_API_HOSTS", "localhost:8000,localhost:9000").split(",")
TAURI_APP_IDENTIFIER = os.getenv("TAURI_APP_IDENTIFIER", "com.persona.ai.vices")

# ============================================
# 22. ADMIN & AUTHENTICATION SETTINGS
# ============================================
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    raise RuntimeError("ADMIN_PASSWORD environment variable is not set. Refusing to start.")
MASTER_TOKEN = os.getenv("MASTER_TOKEN") # <-- Add this line
ADMIN_TOKEN_SECRET = os.getenv("ADMIN_TOKEN_SECRET", "your-secret-key-change-in-production")
REQUEST_STORAGE_PATH = os.getenv("REQUEST_STORAGE_PATH", str(DATA_DIR / "access_requests.json"))
APPROVED_TOKENS_PATH = os.getenv("APPROVED_TOKENS_PATH", str(DATA_DIR / "approved_tokens.json"))

# ============================================
# 23. RULE ENGINE (DGBA) CONFIGURATION
# ============================================
# Number of interactions between meta-cognitive consolidation passes.
RULE_ENGINE_CONSOLIDATION_INTERVAL = int(os.getenv("RULE_ENGINE_CONSOLIDATION_INTERVAL", "10"))
# Max rules the model can generate in a single consolidation pass.
RULE_ENGINE_MAX_RULES_PER_PASS = int(os.getenv("RULE_ENGINE_MAX_RULES_PER_PASS", "3"))
# Top-K approved rules retrieved per prompt build.
RULE_ENGINE_TOP_K_RULES = int(os.getenv("RULE_ENGINE_TOP_K_RULES", "5"))
# Lower temperature for reflection pass — reduces hallucinated rule content.
RULE_ENGINE_REFLECTION_TEMPERATURE = float(os.getenv("RULE_ENGINE_REFLECTION_TEMPERATURE", "0.35"))
