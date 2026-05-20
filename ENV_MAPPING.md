# PERSONA-AI ENVIRONMENT VARIABLE MAPPING

This document maps every configurable variable to its source code locations and usage.

## Quick Reference

### Model & Engine Configuration
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `LLAMA_BASE_URL` | generation.py | Local LLaMA.cpp API endpoint | http://127.0.0.1:8080/v1 |
| `LLAMA_TIMEOUT` | generation.py | Request timeout in seconds | 120 |
| `MODEL_PATH` | image_generator.py | Stable Diffusion model file path | C:\AI\models\realismByStableYogi_sd15V9.safetensors |
| `IMAGE_GEN_TIMEOUT` | image_generator.py | Image generation timeout | 60 |
| `EMOTION_MODEL_DIR` | emotion_engine.py | ONNX emotion model directory | C:\AI\models\emotion_roberta_onnx |
| `EMOTION_TOKENIZER_NAME` | emotion_engine.py | Emotion tokenizer model name | j-hartmann/emotion-english-distilroberta-base |
| `EMBEDDING_MODEL` | memory.py | Sentence transformer for embeddings | BAAI/bge-small-en-v1.5 |
| `RERANKER_MODEL` | reranker.py | BGE reranker model | BAAI/bge-reranker-base |
| `DPO_MODEL_NAME` | train_dpo.py | Base model for DPO training | unsloth/llama-3-8b-Instruct-bnb-4bit |

### Memory & Database
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `TV_INDEX_PATH` | memory.py, build_memory_db.py | Turbovec index file path | turbovec_memory.tvim |
| `METADATA_PATH` | memory.py, build_memory_db.py | Memory metadata JSON path | memory_metadata.json |
| `GRAPH_DATABASE_PATH` | graph_memory.py | Graph database JSON path | lancedb_data/relational_graph.json |
| `CLASSIFIED_MEMORIES_PATH` | build_memory_db.py | Classified memories source | classified_memories.json |
| `PERSONALITY_DATASET_PATH` | build_dataset.py | Personality dataset path | personality_dataset.json |
| `PREFERENCES_PATH` | train_dpo.py | DPO preferences file | preferences.jsonl |
| `MEMORY_TELEMETRY_PATH` | (future: logging) | Telemetry output file | telemetry_logs.jsonl |

### Retrieval Engine
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `RETRIEVAL_INITIAL_K` | memory.py | Initial vectors to pull from index | 8 |
| `RETRIEVAL_MAX_EXPLICIT_DOCS` | memory.py | Max explicit content in context | 1 |
| `RETRIEVAL_FINAL_RETURN_COUNT` | memory.py | Final chunks returned to LLM | 3 |
| `TURBOVEC_BIT_WIDTH` | build_memory_db.py | Turbovec quantization bits | 4 |

### Generation Parameters
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `GENERATION_TEMPERATURE` | generation.py | Model temperature (randomness) | 0.85 |
| `GENERATION_TOP_P` | generation.py | Nucleus sampling parameter | 0.9 |
| `GENERATION_FREQUENCY_PENALTY` | generation.py | Penalty for repeated tokens | 0.1 |
| `GENERATION_PRESENCE_PENALTY` | generation.py | Penalty for seen tokens | 0.1 |
| `DEFAULT_ACTIVE_MODEL` | state.py | Default LLM model to use | default |

### Emotional State
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `BASELINE_VALENCE` | emotion_engine.py, prompt_builder.py | Starting happiness level (-1.0 to 1.0) | 0.20 |
| `BASELINE_AROUSAL` | emotion_engine.py, prompt_builder.py | Starting energy level (-1.0 to 1.0) | 0.10 |
| `EMOTION_DELTA_MULTIPLIER` | emotion_engine.py | Emotion shift smoothing factor | 0.15 |

### Image Generation
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `TEMP_IMAGE_DIR` | image_generator.py, media_handler.py | Directory for generated images | {tempdir}/persona_ai_images |
| `IMAGE_BASE_PROMPT` | image_generator.py | Character physical description | Brown/blonde hair, 18yo, latina... |
| `IMAGE_NEGATIVE_PROMPT` | image_generator.py | What to avoid in generation | Deformed, text, low quality... |
| `IMAGE_INFERENCE_STEPS` | image_generator.py | Generation quality steps | 20 |
| `IMAGE_GUIDANCE_SCALE` | image_generator.py | Prompt adherence strength | 7.5 |

### Media Handling
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `MEDIA_FRAMES_TO_EXTRACT` | media_handler.py | Video frames to extract | 3 |
| `MEDIA_MAX_TEXT_LENGTH` | media_handler.py | Max characters from web text | 400 |
| `MEDIA_EXTENSIONS` | media_handler.py | Supported media file types | .jpg,.jpeg,.png,.webp,.gif,.mp4,.webm |

### Server Configuration
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `SERVER_HOST` | server.py | FastAPI server host | 0.0.0.0 |
| `SERVER_PORT` | server.py | FastAPI server port | 8000 |
| `CORS_ALLOW_ORIGINS` | server.py | CORS allowed origins | * |
| `CORS_ALLOW_METHODS` | server.py | CORS allowed methods | * |
| `CORS_ALLOW_HEADERS` | server.py | CORS allowed headers | * |
| `VIDEO_RECORDING_MODE` | server.py | Enable video recording | false |
| `MAX_CONCURRENT_REQUESTS` | server.py | Concurrent request limit | 1 |

### Broker/Tunnel
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `CURRENT_RUNTIME_TUNNEL` | server.py | Desktop app tunnel URL | http://localhost:8000 |
| `IS_DEVELOPER_PRESENT` | server.py | Developer presence flag | true |
| `BROKER_PORT` | server.py | Broker server port | 8001 |

### Web Search
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `WEB_SEARCH_MAX_RESULTS` | server.py | DuckDuckGo result limit | 3 |

### Conversation
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `HISTORY_WINDOW_SIZE` | app.py | Messages to keep in history | 12 |
| `SUMMARY_MESSAGE_WINDOW` | summarizer.py | Messages for summary context | 8 |

### Persona
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `BASE_PERSONA_NAME` | prompt_builder.py | Character name | Rosia |
| `BASE_PERSONA_AGE` | prompt_builder.py | Character age | 18 |
| `BASE_PERSONA_LOCATION` | prompt_builder.py | Character location | UK |
| `BASE_PERSONA_VOICE_PLATFORM` | prompt_builder.py | Communication platform | Discord |
| `MOOD_DESCRIPTION` | state.py | Mood tone descriptor | sultry, highly personal... |
| `TIMEZONE` | prompt_builder.py | Timezone for system clock | Europe/London |

### Content Filtering
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `EXPLICIT_WORDS` | memory.py | Words to filter out | cum,cock,pussy,fuck,daddy |
| `ENABLE_CONTENT_GUARDRAILS` | memory.py | Enable guardrail filtering | true |

### Performance
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `MAX_VRAM_ALLOCATION` | emotion_engine.py, image_generator.py | Max VRAM in GB | 4 |
| `EMOTION_CPU_ONLY` | emotion_engine.py | Force emotion engine to CPU | true |
| `ENABLE_GRADIENT_CHECKPOINTING` | train_dpo.py | Memory-saving gradient checkpointing | true |

### Training
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `DPO_BATCH_SIZE` | train_dpo.py | Training batch size | 2 |
| `DPO_GRADIENT_ACCUMULATION_STEPS` | train_dpo.py | Gradient accumulation steps | 4 |
| `DPO_NUM_EPOCHS` | train_dpo.py | Training epochs | 3 |
| `DPO_LEARNING_RATE` | train_dpo.py | Learning rate | 5e-6 |
| `DPO_BETA` | train_dpo.py | DPO temperature | 0.1 |
| `LORA_RANK` | train_dpo.py | LoRA rank | 16 |
| `LORA_ALPHA` | train_dpo.py | LoRA alpha scaling | 16 |
| `LORA_DROPOUT` | train_dpo.py | LoRA dropout | 0 |
| `OPTIMIZER_TYPE` | train_dpo.py | Optimizer algorithm | adamw_8bit |
| `WARMUP_RATIO` | train_dpo.py | Warmup ratio | 0.1 |
| `TRAINING_OUTPUT_DIR` | train_dpo.py | Training output directory | outputs |
| `LORA_OUTPUT_PATH` | train_dpo.py | LoRA adapter save path | rosia-dpo-lora |

### Graph Memory
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `GRAPH_ENTITY_CAREER` | graph_memory.py | Career-related keywords | internship,startup,code,agent,rag,linux |
| `GRAPH_ENTITY_FAMILY` | graph_memory.py | Family-related keywords | father,cousin,family,parents |
| `GRAPH_ENTITY_LIFESTYLE` | graph_memory.py | Lifestyle keywords | bmw,car,music,gaming,setup |
| `GRAPH_MIN_WEIGHT_THRESHOLD` | graph_memory.py | Min graph edge weight | 1 |

### Features
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `NORMALIZE_SLANG` | memory.py | Enable slang normalization | true |
| `DEBUG_MODE` | (all) | Verbose debug logging | false |
| `LOG_LEVEL` | (all) | Logging level | INFO |
| `TELEMETRY_ENABLED` | (future: logging) | Enable telemetry | true |
| `TELEMETRY_FLUSH_INTERVAL` | (future: logging) | Telemetry interval in seconds | 60 |

### Frontend (Web App)
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `VITE_API_BASE_URL` | frontend/src/app/App.tsx | Backend API endpoint for web chat | https://commissioner-twin-submitted-protest.trycloudflare.com |

### Frontend App (Tauri Desktop)
| Variable | File(s) | Purpose | Default |
|----------|---------|---------|---------|
| `VITE_BROKER_URL` | frontend_app/src/app/components/Gatekeeper.tsx | Broker server URL for authorization | http://localhost:9000 |
| `DEV_TUNNEL_URL` | frontend_app/vite.config.ts | Dev tunnel URL for Vite proxy | http://localhost:8000 |
| `TAURI_PRODUCT_NAME` | frontend_app/src-tauri/tauri.conf.json | App product name | Vices |
| `TAURI_WINDOW_TITLE` | frontend_app/src-tauri/tauri.conf.json | Window title | Vices Core |
| `TAURI_WINDOW_WIDTH` | frontend_app/src-tauri/tauri.conf.json | Window width in pixels | 800 |
| `TAURI_WINDOW_HEIGHT` | frontend_app/src-tauri/tauri.conf.json | Window height in pixels | 600 |
| `VITE_DEV_PORT` | frontend_app/vite.config.ts | Vite dev server port | 5173 |
| `TAURI_DEV_URL` | frontend_app/src-tauri/tauri.conf.json | Tauri dev URL | http://localhost:5173 |
| `TAURI_API_HOSTS` | frontend_app/src-tauri/tauri.conf.json | Allowed API hosts for CSP | localhost:8000,localhost:9000 |
| `TAURI_APP_IDENTIFIER` | frontend_app/src-tauri/tauri.conf.json | App identifier/bundle ID | com.persona.ai.vices |

## How to Use

### For Development
1. Copy `.env` to `.env.local` for local overrides
2. Update any values you want to change
3. Environment variables are automatically loaded by `config.py`

### For Deployment
1. Set environment variables in your deployment platform (Docker, K8s, AWS, etc.)
2. The `config.py` module will read from the system environment
3. All defaults in `.env` act as fallbacks

### Adding New Variables
1. Add the variable to `.env` with a default value
2. Add the same variable to `config.py` with `os.getenv()` and a default
3. Import from `config` in your code instead of using hardcoded values
4. Update this mapping document

## Migration Checklist

Files that need to import from `config.py`:
- [ ] generation.py - LLAMA_BASE_URL, timeouts, generation params
- [ ] memory.py - TV_INDEX_PATH, METADATA_PATH, retrieval params, explicit words
- [ ] emotion_engine.py - BASELINE_*, EMOTION_MODEL_DIR, EMOTION_TOKENIZER_NAME
- [ ] image_generator.py - MODEL_PATH, TEMP_IMAGE_DIR, prompts, inference params
- [ ] media_handler.py - TEMP_IMAGE_DIR, media handling params
- [ ] server.py - SERVER_HOST, SERVER_PORT, CORS, tunnels, web search
- [ ] prompt_builder.py - TIMEZONE, MOOD_DESCRIPTION, persona params
- [ ] state.py - DEFAULT_ACTIVE_MODEL
- [ ] build_memory_db.py - TV_INDEX_PATH, METADATA_PATH, TURBOVEC_BIT_WIDTH
- [ ] train_dpo.py - All DPO_* and LORA_* variables, training params
- [ ] graph_memory.py - GRAPH_DATABASE_PATH, entity keywords
- [ ] reranker.py - RERANKER_MODEL
- [ ] summarizer.py - SUMMARY_MESSAGE_WINDOW
- [ ] app.py - HISTORY_WINDOW_SIZE

## Next Steps

1. **Install python-dotenv** (if not already installed):
   ```bash
   pip install python-dotenv
   ```

2. **Update imports** in each file to use config:
   ```python
   from config import VARIABLE_NAME
   ```

3. **Replace hardcoded values** with config imports

4. **Test** that all functionality works with environment variables

5. **Create `.env.local`** for local development overrides
