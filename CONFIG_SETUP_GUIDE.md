# Environment Variable Setup Guide for Persona-AI

## Overview

All configurable variables in Persona-AI are now managed through a centralized `.env` environment file. This eliminates hardcoded values and makes it easy to customize the system for different environments.

## Quick Start

### 1. Install Dependencies

```bash
pip install python-dotenv
```

This library automatically loads variables from the `.env` file into your environment.

### 2. Configure Your `.env` File

The `.env` file is already populated with sensible defaults. Edit it to customize values for your setup:

```bash
# Edit the .env file with your preferred editor
nano .env
# or
vim .env
# or open in VS Code
```

### 3. Verify Configuration

Run this Python command to verify all configs are loaded correctly:

```python
from config import *
print("Configuration loaded successfully!")
```

## Configuration Files

### `.env` (Main Configuration)
- Contains all environment variables with defaults
- Should be in the project root
- Never commit to git (already in .gitignore)

### `config.py` (Configuration Loader)
- Loads all variables from `.env` 
- Converts string values to appropriate types (int, float, bool)
- Provides fallback defaults
- Should be imported in all Python modules

### `ENV_MAPPING.md` (Reference Guide)
- Documents every variable
- Shows which files use it
- Explains what each variable controls
- Useful for understanding the full system

## Customization by Environment

### Development

Create `.env.local` for local overrides:

```bash
# .env.local
DEBUG_MODE=true
LOG_LEVEL=DEBUG
SERVER_PORT=8000
```

Import in Python:

```python
from dotenv import load_dotenv
load_dotenv('.env.local', override=True)  # Override .env settings
from config import *
```

### Production/Docker

Set environment variables directly:

```dockerfile
FROM python:3.11
ENV LLAMA_BASE_URL=https://llama-api.example.com
ENV SERVER_PORT=8000
ENV TIMEZONE=UTC
```

The `config.py` will automatically read from the system environment.

### Testing

```bash
# Set test-specific variables
export LLAMA_TIMEOUT=5
export DEBUG_MODE=true
export WEB_SEARCH_MAX_RESULTS=1

python -m pytest tests/
```

## Variable Categories

### 1. Models & Engines

**Key Variables:**
- `LLAMA_BASE_URL` - Your local LLaMA.cpp server
- `MODEL_PATH` - Stable Diffusion model location
- `EMOTION_MODEL_DIR` - ONNX emotion model directory

**When to Change:**
- Switching to a different local server
- Using a different model file
- Changing model paths for deployment

### 2. Memory & Retrieval

**Key Variables:**
- `TV_INDEX_PATH` - Vector index location
- `METADATA_PATH` - Memory metadata file
- `RETRIEVAL_INITIAL_K` - How many vectors to retrieve
- `RETRIEVAL_FINAL_RETURN_COUNT` - Context chunks returned

**When to Change:**
- Tuning retrieval sensitivity
- Storing memory databases elsewhere
- Changing performance/accuracy tradeoff

### 3. Generation Parameters

**Key Variables:**
- `GENERATION_TEMPERATURE` - Model randomness (0.0-2.0)
- `GENERATION_TOP_P` - Nucleus sampling (0.0-1.0)
- `GENERATION_FREQUENCY_PENALTY` - Penalize repeated tokens

**Best Practices:**
- Higher temperature (>0.8) = more creative
- Lower temperature (<0.5) = more consistent
- Adjust based on response quality

### 4. Emotional State

**Key Variables:**
- `BASELINE_VALENCE` - Starting happiness (-1.0 to 1.0)
- `BASELINE_AROUSAL` - Starting energy (-1.0 to 1.0)

**Examples:**
- Happy: `BASELINE_VALENCE=0.7`
- Tired: `BASELINE_AROUSAL=-0.5`
- Neutral: `BASELINE_VALENCE=0.0, BASELINE_AROUSAL=0.0`

### 5. Image Generation

**Key Variables:**
- `IMAGE_BASE_PROMPT` - Character physical description
- `IMAGE_NEGATIVE_PROMPT` - What to avoid generating
- `IMAGE_INFERENCE_STEPS` - Quality (higher = better but slower)
- `IMAGE_GUIDANCE_SCALE` - Prompt adherence strength

**Tips:**
- Increase `IMAGE_INFERENCE_STEPS` for higher quality (20-30 is good)
- Increase `IMAGE_GUIDANCE_SCALE` for stricter prompt following (7.5-15)
- Edit `IMAGE_BASE_PROMPT` to change character appearance

### 6. Server & API

**Key Variables:**
- `SERVER_PORT` - FastAPI server port
- `CORS_ALLOW_ORIGINS` - Allowed CORS origins
- `WEB_SEARCH_MAX_RESULTS` - DuckDuckGo result limit

**Security Tips:**
- Set `CORS_ALLOW_ORIGINS` to specific domains in production
- Use `CURRENT_RUNTIME_TUNNEL` for secure tunneling
- Set `IS_DEVELOPER_PRESENT=false` in production

### 7. Frontend Configuration

**Web App Variables:**
- `VITE_API_BASE_URL` - Backend API endpoint for frontend

**Tauri Desktop App Variables:**
- `VITE_BROKER_URL` - Broker server for authentication
- `DEV_TUNNEL_URL` - Dev tunnel for Vite proxy
- `TAURI_PRODUCT_NAME` - App product name
- `TAURI_WINDOW_TITLE` - Window title
- `TAURI_WINDOW_WIDTH` - Window width in pixels
- `TAURI_WINDOW_HEIGHT` - Window height in pixels
- `VITE_DEV_PORT` - Vite dev server port
- `TAURI_DEV_URL` - Tauri dev URL
- `TAURI_API_HOSTS` - Allowed hosts for CSP
- `TAURI_APP_IDENTIFIER` - App bundle identifier

**When to Change:**
- Updating backend API endpoint
- Changing broker/tunnel URLs for deployments
- Customizing window size/title for desktop app
- Changing allowed hosts for security policies

### 8. Training & Optimization

**Key Variables:**
- `DPO_BATCH_SIZE` - Training batch size (keep low for VRAM)
- `DPO_LEARNING_RATE` - Model learning rate (5e-6 is good)
- `LORA_RANK` - LoRA adapter size (lower = fewer params)
- `ENABLE_GRADIENT_CHECKPOINTING` - Memory saving technique

**VRAM Management:**
- If VRAM errors: Lower `DPO_BATCH_SIZE` to 1
- Increase `DPO_GRADIENT_ACCUMULATION_STEPS` instead
- Set `EMOTION_CPU_ONLY=true` to free GPU VRAM

## Common Configurations

### Lean Setup (Low VRAM)

```env
MAX_VRAM_ALLOCATION=2
EMOTION_CPU_ONLY=true
ENABLE_GRADIENT_CHECKPOINTING=true
DPO_BATCH_SIZE=1
DPO_GRADIENT_ACCUMULATION_STEPS=8
GENERATION_TEMPERATURE=0.7
IMAGE_INFERENCE_STEPS=15
```

### High Performance Setup

```env
MAX_VRAM_ALLOCATION=8
EMOTION_CPU_ONLY=false
DPO_BATCH_SIZE=4
GENERATION_TEMPERATURE=0.9
IMAGE_INFERENCE_STEPS=50
RETRIEVAL_INITIAL_K=16
```

### Privacy-Focused Setup

```env
WEB_SEARCH_MAX_RESULTS=0
ENABLE_CONTENT_GUARDRAILS=true
TELEMETRY_ENABLED=false
CORS_ALLOW_ORIGINS=localhost
IS_DEVELOPER_PRESENT=true
```

### Production Setup

```env
DEBUG_MODE=false
LOG_LEVEL=WARNING
SERVER_HOST=0.0.0.0
CORS_ALLOW_ORIGINS=https://yourdomain.com
IS_DEVELOPER_PRESENT=false
TELEMETRY_ENABLED=true
TELEMETRY_FLUSH_INTERVAL=300
```

### Frontend Development Setup

```env
# Web app configuration
VITE_API_BASE_URL=http://localhost:8000

# Tauri desktop app configuration
VITE_BROKER_URL=http://localhost:9000
DEV_TUNNEL_URL=http://localhost:8000
TAURI_API_HOSTS=localhost:8000,localhost:9000
```

### Frontend Production Setup

```env
# Web app production
VITE_API_BASE_URL=https://api.yourdomain.com

# Tauri desktop production
VITE_BROKER_URL=https://broker.yourdomain.com
TAURI_API_HOSTS=api.yourdomain.com,broker.yourdomain.com
```

## Troubleshooting

### "Config variable not found"

```python
from config import NON_EXISTENT_VAR
# Error: ImportError: cannot import name 'NON_EXISTENT_VAR'
```

**Solution:** Check spelling in `.env` and `config.py`. Variable names are case-sensitive.

### Environment variable not being read

```bash
# Verify .env file exists
ls -la .env

# Check content
cat .env

# Verify path
pwd
```

### Config changes not taking effect

Python caches imports. Restart your Python process:

```bash
# Kill the running process
Ctrl+C

# Restart
python app.py
```

### Type errors (e.g., string instead of int)

Check `config.py` has proper type conversion:

```python
# Good ✓
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "2"))

# Bad ✗
BATCH_SIZE = os.getenv("BATCH_SIZE", "2")  # Returns string "2"
```

## Adding New Configuration Variables

### 1. Add to `.env`

```env
# My new feature configuration
MY_NEW_FEATURE_ENABLED=true
MY_NEW_TIMEOUT=30
MY_NEW_THRESHOLD=0.5
```

### 2. Add to `config.py`

```python
# In appropriate section with comment
MY_NEW_FEATURE_ENABLED = os.getenv("MY_NEW_FEATURE_ENABLED", "false").lower() == "true"
MY_NEW_TIMEOUT = int(os.getenv("MY_NEW_TIMEOUT", "30"))
MY_NEW_THRESHOLD = float(os.getenv("MY_NEW_THRESHOLD", "0.5"))
```

### 3. Import in Your Module

```python
from config import MY_NEW_FEATURE_ENABLED, MY_NEW_TIMEOUT

if MY_NEW_FEATURE_ENABLED:
    # Use MY_NEW_TIMEOUT here
    timeout_seconds = MY_NEW_TIMEOUT
```

### 4. Document in `ENV_MAPPING.md`

```markdown
| MY_NEW_FEATURE_ENABLED | my_module.py | Enable new feature | false |
| MY_NEW_TIMEOUT | my_module.py | Feature timeout in seconds | 30 |
```

## Environment Variable Types

### Boolean

```env
ENABLE_FEATURE=true
ENABLE_FEATURE=false
```

**In config.py:**
```python
ENABLE_FEATURE = os.getenv("ENABLE_FEATURE", "false").lower() == "true"
```

### Integer

```env
BATCH_SIZE=4
PORT=8000
```

**In config.py:**
```python
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "4"))
```

### Float

```env
LEARNING_RATE=5e-6
TEMPERATURE=0.85
THRESHOLD=0.95
```

**In config.py:**
```python
LEARNING_RATE = float(os.getenv("LEARNING_RATE", "5e-6"))
```

### String List (comma-separated)

```env
ALLOWED_ORIGINS=localhost,127.0.0.1,example.com
EXPLICIT_WORDS=word1,word2,word3
```

**In config.py:**
```python
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "localhost").split(",")
```

### Paths

```env
MODEL_PATH=/path/to/model.safetensors
DATA_DIR=/data/memories
```

**In config.py:**
```python
MODEL_PATH = os.path.abspath(os.path.expanduser(os.getenv("MODEL_PATH", "model.safetensors")))
```

## Git Workflow

### Never commit `.env`

```bash
# Already in .gitignore, but verify:
cat .gitignore | grep "\.env"
```

### Share config template

```bash
# Create .env.example for team
cp .env .env.example
# Remove sensitive values:
# EMOTION_MODEL_DIR=<path-to-model>
# MODEL_PATH=<path-to-model>

git add .env.example
```

### Load team config

```bash
# Team member downloads project
git clone repo.git
cp .env.example .env
# Edit .env with their paths
```

## Performance Tuning

### Retrieval Performance

```env
RETRIEVAL_INITIAL_K=16        # More vectors = slower but better recall
RETRIEVAL_FINAL_RETURN_COUNT=5  # More context = slower but more info
TURBOVEC_BIT_WIDTH=4          # Smaller bits = faster but less accurate
```

### Generation Speed

```env
GENERATION_TEMPERATURE=0.5    # Lower temp = faster (less sampling)
LLAMA_TIMEOUT=60              # Lower timeout = fail faster
IMAGE_INFERENCE_STEPS=15      # Fewer steps = faster generation
```

## References

- [python-dotenv documentation](https://github.com/theskumar/python-dotenv)
- [12-Factor App - Config](https://12factor.net/config)
- [Environment Variables Best Practices](https://stackoverflow.com/questions/5971312)

## Support

For questions or issues with configuration:

1. Check `ENV_MAPPING.md` for detailed variable list
2. Review this guide's troubleshooting section
3. Examine `config.py` for type conversion logic
4. Check `.env` for actual values being used

---

**Last Updated:** 2025-05-19
**Config Version:** 1.0
