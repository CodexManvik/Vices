# VICES — Local-First AI Agent & Companion

VICES is a desktop AI agent that runs **100% on your own machine**. It chats,
speaks, listens, sees images, executes tasks on your PC under strict
permissions — and it *learns*: every completed task can become a reviewable
markdown skill it uses to do better next time (**RSM — Reflective Skill
Memory**).

## Highlights

- **Local everything** — llama.cpp LLM, Kokoro TTS, Whisper STT, Stable
  Diffusion image gen, turbovec + LanceDB memory. No cloud required
  (optional OpenAI-compatible cloud backend if you want it).
- **RSM learning without fine-tuning** — the agent reflects on conversations
  and tasks, writes behavioral rules + procedural skills as plain markdown
  files you can read, edit, or git-version. You approve or reject everything;
  outcome tracking automatically promotes what works and retires what fails.
- **Real agent loop** — multi-step tool use (files, shell, web) with a
  permission manifest, full audit log, and one-click rollback of file changes.
- **Personas** — built-in companion, custom personas, or a style distilled
  privately from your own chat exports (WhatsApp/Telegram/Discord/CSV).
- **Measurable** — a built-in A/B benchmark runs the agent with and without
  RSM knowledge and reports success rates (see `backend/benchmark_agent.py`).

## Install

Prerequisites: [Python 3.10+](https://python.org), [Node.js 20+](https://nodejs.org), [Rust](https://rustup.rs) (for Tauri).

```bash
# Windows (PowerShell) — add -Cuda for NVIDIA builds of llama.cpp
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

```bash
# Linux / macOS — add --cuda for NVIDIA builds of llama.cpp
bash scripts/install.sh
```

The installer creates a Python venv, installs all dependencies, and downloads
the llama.cpp server binary into `bin/llama/`.

## Add models

Drop model files into the `models/` folder — that's it. See
[models/README.md](models/README.md) for download links.

| Folder | What | Required? |
|---|---|---|
| `models/llm/` | Chat model (`.gguf`) | **Yes** — the only manual step |
| `models/tts/` | Kokoro voice | Auto-downloads on first startup |
| `models/stt/` | Whisper | Auto-downloads on first startup |
| `models/image/` | SD checkpoint (`.safetensors`) | No — selfies disabled without it |

## Run

```bash
# Windows
powershell -ExecutionPolicy Bypass -File scripts\start.ps1
```

```bash
# Linux / macOS
bash scripts/start.sh
```

This starts the backend (which auto-spawns the LLM engine — no manual
llama.cpp wrangling) and opens the desktop app. First launch loads models,
so give it a moment.

## Architecture

```
frontend_app/   Tauri v2 + React desktop app
backend/        FastAPI server
  agent_loop.py         multi-step tool loop (JSON tool calls)
  knowledge_store.py    RSM: rules + skills as markdown on disk
  rule_engine.py        reflection pass -> behavioral rules
  skill_engine.py       task reflection -> procedural skills
  mcp_executor.py       fs/shell/web tools + permission manifest
  transaction_log.py    audit log + rollback
  memory.py             episodic memory (turbovec 4-bit)
  tts_engine.py         Kokoro (local) / Edge (fallback)
  stt_engine.py         faster-whisper voice input
  image_generator.py    Stable Diffusion selfies
  benchmark_agent.py    RSM on/off A/B evaluation
models/         your model files (see models/README.md)
bin/llama/      llama.cpp server binary (installed by script)
scripts/        install + start scripts
```

Learned knowledge lives in `~/.vices/knowledge/` as markdown files;
permissions in `~/.vices/permissions.yaml`; the transaction log in
`~/.vices/transactions.json`.

## Configuration

Copy `.env.example` to `.env` (the installer does this) and adjust as needed.
Key settings:

| Variable | Default | Meaning |
|---|---|---|
| `AGENT_LOOP_ENABLED` | `true` | multi-step agent loop |
| `AGENT_MAX_STEPS` | `8` | tool-step budget per turn |
| `GENERATION_BACKEND` | `local` | `local` (llama.cpp) or `cloud` |
| `TTS_ENGINE` | `kokoro` | `kokoro` (local) or `edge` (cloud) |
| `STT_MODEL_SIZE` | `small` | whisper size: tiny/base/small/medium |
| `MAX_VRAM_ALLOCATION` | `4` | GB budget; ≤4 keeps aux models on CPU |

## Evaluation (dissertation)

```bash
# A/B benchmark: agent with vs without RSM knowledge
.venv/Scripts/python backend/benchmark_agent.py --seed --runs 3
```

Metrics endpoint: `GET /admin/eval/metrics` — all values are measured from
stored data; missing data reports as `null`, never a fabricated default.

## API

Swagger docs at `http://localhost:8000/docs` when the backend is running.
