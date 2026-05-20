# Persona-AI Configuration Quick Reference

## Files at a Glance

| File | Purpose | Edit? |
|------|---------|-------|
| `.env` | All configuration variables | ✅ YES |
| `config.py` | Loads `.env` and provides variables | ❌ NO |
| `.env.example` | Template to share with team | ❌ NO |
| `ENV_MAPPING.md` | Variable reference guide | ℹ️ READ |
| `CONFIG_SETUP_GUIDE.md` | Complete setup documentation | ℹ️ READ |
| `MIGRATION_SUMMARY.md` | What changed during migration | ℹ️ READ |

---

## Common Configuration Tasks

### Change LLaMA Server URL
```env
LLAMA_BASE_URL=http://your-server:8080/v1
```

### Tune Model Generation
```env
GENERATION_TEMPERATURE=0.9        # More creative (0.0-2.0)
GENERATION_TOP_P=0.95             # More diverse
GENERATION_FREQUENCY_PENALTY=0.2  # Avoid repetition
```

### Adjust Image Quality
```env
IMAGE_INFERENCE_STEPS=30          # Higher = better quality but slower
IMAGE_GUIDANCE_SCALE=15           # Higher = stricter prompt following
```

### Change Character Personality
```env
BASE_PERSONA_NAME=NewName
BASE_PERSONA_AGE=20
BASE_PERSONA_LOCATION=US
BASELINE_VALENCE=0.7              # More happy
BASELINE_AROUSAL=0.5              # More energetic
```

### Optimize for Low VRAM
```env
MAX_VRAM_ALLOCATION=2
EMOTION_CPU_ONLY=true
DPO_BATCH_SIZE=1
DPO_GRADIENT_ACCUMULATION_STEPS=8
IMAGE_INFERENCE_STEPS=15
```

### Enable Debug Mode
```env
DEBUG_MODE=true
LOG_LEVEL=DEBUG
```

### Production Settings
```env
DEBUG_MODE=false
LOG_LEVEL=WARNING
IS_DEVELOPER_PRESENT=false
ENABLE_CONTENT_GUARDRAILS=true
CORS_ALLOW_ORIGINS=https://yourdomain.com
```

---

## Import Pattern

### In Any Python File
```python
# Import what you need
from config import VARIABLE_NAME, ANOTHER_VARIABLE

# Use it
if VARIABLE_NAME:
    print(ANOTHER_VARIABLE)
```

### Import All (not recommended)
```python
from config import *
# Now all 110+ variables are available
```

---

## Environment Variable Hierarchy

**Priority Order** (highest to lowest):
1. System environment variables
2. `.env` file values  
3. `config.py` defaults

```bash
# This overrides .env:
export LLAMA_BASE_URL=http://override:8080

# But this is recommended instead (in .env):
LLAMA_BASE_URL=http://override:8080
```

---

## Type Examples

### Boolean (true/false)
```env
DEBUG_MODE=true
DEBUG_MODE=false
ENABLE_CONTENT_GUARDRAILS=true
```

### Integer
```env
SERVER_PORT=8000
DPO_BATCH_SIZE=4
HISTORY_WINDOW_SIZE=12
```

### Float
```env
GENERATION_TEMPERATURE=0.85
BASELINE_VALENCE=0.20
LORA_LEARNING_RATE=5e-6
```

### String (no quotes needed)
```env
LLAMA_BASE_URL=http://127.0.0.1:8080/v1
BASE_PERSONA_NAME=Rosia
```

### String List (comma-separated)
```env
EXPLICIT_WORDS=word1,word2,word3
CORS_ALLOW_ORIGINS=localhost,127.0.0.1
```

### Paths (use forward slashes or escaped backslashes)
```env
MODEL_PATH=/path/to/model.safetensors
EMOTION_MODEL_DIR=C:\AI\models\emotion
```

---

## Essential Variables by Use Case

### Running the Chat
```env
LLAMA_BASE_URL
LLAMA_TIMEOUT
TV_INDEX_PATH
METADATA_PATH
HISTORY_WINDOW_SIZE
GENERATION_TEMPERATURE
```

### Generating Images
```env
MODEL_PATH
IMAGE_BASE_PROMPT
IMAGE_NEGATIVE_PROMPT
IMAGE_INFERENCE_STEPS
IMAGE_GUIDANCE_SCALE
TEMP_IMAGE_DIR
```

### Training/Fine-tuning
```env
DPO_MODEL_NAME
DPO_BATCH_SIZE
DPO_LEARNING_RATE
LORA_RANK
LORA_OUTPUT_PATH
TRAINING_OUTPUT_DIR
```

### Running the Server
```env
SERVER_HOST
SERVER_PORT
CORS_ALLOW_ORIGINS
DEBUG_MODE
LOG_LEVEL
```

---

## Development vs Production

### Development
```bash
# .env for development
DEBUG_MODE=true
LOG_LEVEL=DEBUG
GENERATION_TEMPERATURE=0.9
IMAGE_INFERENCE_STEPS=20
TELEMETRY_ENABLED=false
```

### Production
```bash
# .env for production
DEBUG_MODE=false
LOG_LEVEL=WARNING
GENERATION_TEMPERATURE=0.7
IMAGE_INFERENCE_STEPS=30
TELEMETRY_ENABLED=true
IS_DEVELOPER_PRESENT=false
```

---

## Useful Commands

```bash
# Verify all variables load
python -c "from config import *; print('✓ Config loaded')"

# Check specific variable
python -c "from config import LLAMA_BASE_URL; print(LLAMA_BASE_URL)"

# List all config variables
python -c "import config; print([x for x in dir(config) if x.isupper()])"

# Check .env file
cat .env

# Backup current config
cp .env .env.backup

# Switch to different config
cp .env.example .env
```

---

## Updating .env

### Safe Way
```bash
# 1. Make backup
cp .env .env.backup

# 2. Edit file
nano .env

# 3. Verify changes
python -c "from config import LLAMA_BASE_URL; print(LLAMA_BASE_URL)"

# 4. If error, restore
cp .env.backup .env
```

---

## Common Mistakes ❌

```python
# ❌ WRONG - hardcoded value
TEMPERATURE = 0.85

# ✅ CORRECT - import from config
from config import GENERATION_TEMPERATURE
TEMPERATURE = GENERATION_TEMPERATURE
```

```env
# ❌ WRONG - quotes not needed
LLAMA_BASE_URL="http://127.0.0.1:8080/v1"

# ✅ CORRECT - no quotes
LLAMA_BASE_URL=http://127.0.0.1:8080/v1
```

```bash
# ❌ WRONG - .env not committed
git add .env

# ✅ CORRECT - .env in .gitignore
# .env is already in .gitignore
```

---

## Performance Tuning Quick Guide

| Adjustment | For | How |
|------------|-----|-----|
| Lower VRAM | Reduce VRAM usage | `EMOTION_CPU_ONLY=true`<br>`DPO_BATCH_SIZE=1` |
| Faster Generation | Speed up responses | `GENERATION_TEMPERATURE=0.5`<br>`IMAGE_INFERENCE_STEPS=15` |
| Better Quality | Improve output | `GENERATION_TEMPERATURE=0.9`<br>`IMAGE_INFERENCE_STEPS=50` |
| More Creative | Varied responses | `GENERATION_TEMPERATURE=1.2`<br>`GENERATION_TOP_P=0.95` |
| More Consistent | Predictable output | `GENERATION_TEMPERATURE=0.3`<br>`GENERATION_TOP_P=0.7` |

---

## Need Help?

1. **Where is X configured?**
   → Check `ENV_MAPPING.md`

2. **How do I set up X?**
   → Check `CONFIG_SETUP_GUIDE.md`

3. **What changed?**
   → Check `MIGRATION_SUMMARY.md`

4. **Can't find a variable?**
   → Check `config.py` for the exact name

5. **Config not working?**
   → Restart Python (caches imports)

---

## Quick Links

- **Config Reference:** `ENV_MAPPING.md`
- **Setup Guide:** `CONFIG_SETUP_GUIDE.md`
- **Migration Details:** `MIGRATION_SUMMARY.md`
- **Configuration Loader:** `config.py`
- **Default Template:** `.env.example`
- **Your Config:** `.env` (edit this!)

---

**Last Updated:** May 19, 2026  
**Version:** 1.0
