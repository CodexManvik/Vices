# Vices

Vices is a local-first, persona-driven conversational system built around **Rosia**: a stateful character with memory retrieval, affective state tracking, multimodal input support, and optional image/voice output.

The repository includes:
- A Python backend (chat engine + broker + memory/training pipeline)
- A React/Tauri frontend (`frontend_app/`)
- Data processing scripts for memory curation and DPO fine-tuning

## What the project does

At runtime, Vices combines:
- **Prompt orchestration** (`prompt_builder.py`)
- **Local LLM streaming** through llama-compatible APIs (`generation.py`)
- **Semantic memory recall** via sentence-transformers + TurboVec (`memory.py`)
- **Graph memory context** (`graph_memory.py`)
- **Affective state updates** with ONNX emotion inference (`emotion_engine.py`)
- **Multimodal handling** for uploaded media and URLs (`media_handler.py`)
- **Image generation** for selfie triggers (`image_generator.py`)
- **Dual FastAPI services** for chat and access control (`server.py`)

## Architecture overview

- **Main API server** (default port `8000`)
  - Chat streaming (`/chat`)
  - Model management (`/models`, `/switch_model`)
  - Status and SSE updates (`/status`, `/status/stream`, `/events`)
  - Feedback collection and admin preference/training endpoints
- **Broker server** (default port `9000`)
  - Access request lifecycle (`/request-waitlist`, `/check-approval`, `/request-access`)
  - Admin approval/deny/waitlist controls
- `server.py` starts both servers together.

## Repository structure

- `server.py` – core backend app and broker app
- `config.py` – centralized environment-based configuration
- `app.py` – minimal CLI chat loop
- `memory.py` / `reranker.py` – retrieval stack
- `emotion_engine.py` / `state.py` – affective state model + runtime state
- `graph_memory.py` – persistent user-topic graph
- `media_handler.py` – media extraction + URL content ingestion
- `image_generator.py` – Stable Diffusion selfie pipeline
- `build_dataset.py` / `classify_memories.py` / `build_memory_db.py` – memory dataset and index pipeline
- `train_dpo.py` – LoRA DPO fine-tuning workflow
- `frontend_app/` – React + Vite + Tauri UI

## Prerequisites

- Python 3.10+
- Node.js 18+ and `pnpm`
- A llama-compatible server reachable at `LLAMA_BASE_URL`
- (Optional) CUDA GPU for faster inference and image generation
- (Optional) Stable Diffusion model file for selfie generation

## Setup

1. **Clone and enter the repo**
2. **Create Python environment**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```
3. **Install Python dependencies**  
   Install required packages used by imports across backend scripts (FastAPI, torch, sentence-transformers, diffusers, etc.).
4. **Configure environment**
   ```bash
   cp .env.example .env
   ```
5. **Set required secrets/values in `.env`**
   - `ADMIN_PASSWORD` (**required**, backend refuses to start without it)
   - `MASTER_TOKEN` (optional developer bypass token)
   - `LLAMA_BASE_URL`
   - `MODEL_PATH` and related image-generation vars if using selfies

## Running the backend

Start both backend services:

```bash
python server.py
```

Default endpoints:
- Main API: `http://localhost:8000`
- Broker API: `http://localhost:9000`

Quick health/status checks:
- `GET /status`
- `GET http://localhost:9000/health`

## Running the frontend

```bash
cd frontend_app
pnpm install
pnpm dev
```

The frontend handles:
- Gatekeeper access flow via broker
- Chat session UI with conversation persistence
- Status/mood visualization via SSE
- Admin dashboard access (keyboard toggle in app)

## Memory/data pipeline

Typical offline preparation flow:

1. `build_dataset.py` – clean/filter exported conversation logs into `personality_dataset.json`
2. `classify_memories.py` – tag memories into `classified_memories.json`
3. `build_memory_db.py` – build TurboVec index + metadata sidecar

Runtime retrieval then uses those generated assets for contextual recall.

## Feedback and training

- User corrections are saved via `POST /feedback` as preference pairs.
- Admin endpoints can review/update preferences and trigger DPO training.
- `train_dpo.py` performs LoRA-based DPO fine-tuning using Unsloth/TRL.

## Safety and operational notes

- This project is designed for local/self-hosted operation.
- Keep `.env` private and never commit credentials.
- `ADMIN_PASSWORD` and token data gate administrative/access actions.
- The repository contains mature-roleplay-oriented persona behaviors and prompts; review and adjust prompt/content guardrail settings in `config.py` before deployment.

## Troubleshooting

- **“ADMIN_PASSWORD environment variable is not set”**  
  Set `ADMIN_PASSWORD` in `.env`.
- **Model connection errors**  
  Verify `LLAMA_BASE_URL` and that your local model server is running.
- **Missing memory recall**  
  Ensure memory index files exist (`TV_INDEX_PATH`, `METADATA_PATH`) and regenerate with `build_memory_db.py` if needed.
- **Image generation failures**  
  Confirm `MODEL_PATH` points to a valid model file and CUDA is available if required by your setup.
