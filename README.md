# VICES AI Pipeline

A high-performance desktop and server hybrid architecture running decentralized, retrieval-augmented companion intelligence.

## Architecture
The system utilizes a client-server hybrid microservices architecture:
1. **Decentralized Frontend (Tauri v2 / React / Vite):** Executed locally in a secure client webview context. Performs hardware-aware capability detection (via WebGPU and WebGL), client-side text sanitization, parallel web scraping (bypassing CORS via tauri-plugin-http), client-side WASM emotion parsing using Xenova/distilroberta-base-emotion-6, and live speech visualizers.
2. **Local Inference Engine (llama.cpp):** Runs quantised Gemma-4 4B models (censored or uncensored) locally on consumer discrete GPUs with VRAM >= 4GB.
3. **Server Backend (FastAPI / Uvicorn):** Manages vector retrieval, entity extraction, relational memory graphs via LanceDB, speech synthesis via Edge-TTS, Stable Diffusion selfie generators, and background llama.cpp subprocess orchestrators.

## Features
- **Adaptive Setup & NSFW Downloader:** Automatically scans GPU memory and offers mature content downloading toggles, retrieving Gemma-4-E4B-Uncensored-HauhauCS or gemma-4-E4B-it from Hugging Face sequentially.
- **Companion Persona Wizard:** Gathers parameters (Name, Pronouns, Dynamics, NSFW traits) and invokes the local LLM to dynamically synthesize custom personality prompts.
- **Memory Diagnostic Console:** Secure password-authenticated dashboard for inspecting and pruning LanceDB vector spaces and networkx relationship graphs.
- **Advanced Control Panels:** Sliders to tune context size (-c), CPU threads (-t), and GPU layers (-ngl) dynamically, along with edge-tts accents and Stable Diffusion base prompts.
- **Real-Time Web Search & Scraper:** Detects URLs, fetches raw text in parallel, and extracts plain text up to 400 words bypassing browser CORS restrictions.
- **Generative Audio & Visual Lip-Sync:** Edge-TTS audio streams synced to Web Audio API analyzer graphs for real-time visual companion mouth sync.
- **Stable Diffusion Selfies:** Real-time generation of custom selfies based on conversation mood states and explicit trigger keywords.
- **Chat Exporter & Code Highlighter:** Highlight code blocks and download conversation histories to JSON format.

## Prerequisites
- Python 3.10+
- Node.js 20+ & pnpm
- Rust toolchain (for Tauri compilation)

## Environment Setup
Create a `.env` file in the root directory:
```bash
LLAMA_BASE_URL=http://127.0.0.1:8080/v1
LLAMA_TIMEOUT=120
MODEL_PATH=C:\AI\models\realismByStableYogi_sd15V9.safetensors
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
CORS_ALLOW_ORIGINS=*
ADMIN_PASSWORD=your_secure_admin_password
ADMIN_TOKEN_SECRET=your_auth_secret_key
REQUEST_STORAGE_PATH=backend/data/access_requests.json
APPROVED_TOKENS_PATH=backend/data/approved_tokens.json
```

## Installation & Run

1. Install Python dependencies:
```bash
pip install fastapi uvicorn pydantic httpx requests duckduckgo-search pytz edge-tts rich lancedb networkx numpy pandas
```

2. Start the Backend API Server:
```bash
# On Windows (PowerShell):
$env:ADMIN_PASSWORD="your_secure_admin_password"
python backend/server.py

# On Linux/macOS:
ADMIN_PASSWORD="your_secure_admin_password" python backend/server.py
```

3. Install Frontend node dependencies:
```bash
cd frontend_app
pnpm install
```

4. Start the Tauri Desktop Client:
```bash
pnpm tauri dev
```

## API Documentation
The FastAPI server exposes Swagger documentation on `/docs` and Redoc on `/redoc` when running.

Primary Endpoints:
- `POST /chat`: Stateless message completion endpoint, supporting history serialization, emotion deltas, and file attachments.
- `GET /status`: Retrieves current valence, arousal, chemistry, and model status metrics.
- `GET /status/stream`: SSE stream broadcasting real-time affective state shifts.
- `GET /personas`: Retrieves companion profiles.
- `POST /personas/setup`: Formulates custom companion system prompts via local LLM.
- `POST /personas/activate`: Switches active companion profiles.
- `GET /settings` / `POST /settings/save`: Fetches and saves advanced configuration presets.
- `GET /admin/memories`: Fetches LanceDB vectors and graph entities.
- `DELETE /admin/memories/vector/{memory_id}`: Deletes a vector record from memory.
- `DELETE /admin/memories/graph/{node_name}`: Deletes a node link from the network graph.
