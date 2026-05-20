# Frontend Configuration Integration Guide

## Overview

This document details the integration of frontend configuration variables into the centralized `.env` environment configuration system. Both the web app (React/Vite) and desktop app (Tauri/React) now use environment variables from the root `.env` file for deployment flexibility and environment-specific configuration.

## What Was Integrated

### Frontend Web App (`/frontend`)
- **Framework:** React 19 + Vite + TypeScript
- **Configuration File:** `frontend/src/app/App.tsx`
- **Variables Integrated:** 1

### Frontend Tauri Desktop App (`/frontend_app`)
- **Framework:** React 19 + Vite + Tauri + TypeScript
- **Configuration Files:** 
  - `frontend_app/vite.config.ts`
  - `frontend_app/src/app/components/Gatekeeper.tsx`
  - `frontend_app/src-tauri/tauri.conf.json`
- **Variables Integrated:** 9

**Total Frontend Variables:** 10

---

## Frontend Configuration Variables

### Web App (1 variable)

#### `VITE_API_BASE_URL`
**Purpose:** Backend API endpoint for the web chat application

**Location:** `frontend/src/app/App.tsx` (line 11)

```typescript
function getApiBaseUrl() {
  const envUrl = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/+$/, "");
  return "https://part-paradise-creativity-containers.trycloudflare.com"; 
}
```

**Usage:**
- Used in all API calls: `/status`, `/chat`, `/feedback`, `/events`, `/images`
- Allows frontend to connect to different backend servers based on environment
- Supports both development and production deployments

**Default:** `https://commissioner-twin-submitted-protest.trycloudflare.com`

**Examples:**
```env
# Development
VITE_API_BASE_URL=http://localhost:8000

# Production
VITE_API_BASE_URL=https://api.yourdomain.com

# Tunnel
VITE_API_BASE_URL=https://your-ngrok-tunnel.ngrok-free.dev
```

---

### Tauri Desktop App (9 variables)

#### `VITE_BROKER_URL`
**Purpose:** Broker server URL for authentication/authorization in desktop app

**Location:** `frontend_app/src/app/components/Gatekeeper.tsx` (line 13)

```typescript
const BROKER_URL = import.meta.env.VITE_BROKER_URL || "http://localhost:9000";
```

**Usage:**
- Used in Gatekeeper component for `POST /request-access` endpoint
- Required for user authentication and session allocation
- Different from API URL (serves authorization, not chat)

**Default:** `http://localhost:9000`

**Examples:**
```env
# Development
VITE_BROKER_URL=http://localhost:9000

# Production
VITE_BROKER_URL=https://broker.yourdomain.com
```

#### `DEV_TUNNEL_URL`
**Purpose:** Dev tunnel URL used in Vite proxy configuration

**Location:** `frontend_app/vite.config.ts` (line 33)

```typescript
proxy: {
  '/api': {
    target: process.env.DEV_TUNNEL_URL || 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  }
}
```

**Usage:**
- Used during development to proxy API calls
- Allows frontend to connect to different backend servers
- Supports ngrok tunnels for remote development

**Default:** `http://localhost:8000`

**Examples:**
```env
# Local development
DEV_TUNNEL_URL=http://localhost:8000

# Remote tunnel
DEV_TUNNEL_URL=https://your-ngrok-tunnel.ngrok-free.dev
```

#### `TAURI_PRODUCT_NAME`
**Purpose:** Product/app name displayed in various places

**Location:** `frontend_app/src-tauri/tauri.conf.json`

**Default:** `Vices`

**Examples:**
```env
TAURI_PRODUCT_NAME=Vices
TAURI_PRODUCT_NAME=PersonaAI
```

#### `TAURI_WINDOW_TITLE`
**Purpose:** Title bar text for the Tauri window

**Location:** `frontend_app/src-tauri/tauri.conf.json`

**Default:** `Vices Core`

**Examples:**
```env
TAURI_WINDOW_TITLE=Vices Core
TAURI_WINDOW_TITLE=Persona AI Chat
```

#### `TAURI_WINDOW_WIDTH`
**Purpose:** Desktop window width in pixels

**Location:** `frontend_app/src-tauri/tauri.conf.json`

**Type:** Integer

**Default:** `800`

**Examples:**
```env
# Compact
TAURI_WINDOW_WIDTH=600

# Standard
TAURI_WINDOW_WIDTH=800

# Wide
TAURI_WINDOW_WIDTH=1200
```

#### `TAURI_WINDOW_HEIGHT`
**Purpose:** Desktop window height in pixels

**Location:** `frontend_app/src-tauri/tauri.conf.json`

**Type:** Integer

**Default:** `600`

**Examples:**
```env
# Compact
TAURI_WINDOW_HEIGHT=400

# Standard
TAURI_WINDOW_HEIGHT=600

# Tall
TAURI_WINDOW_HEIGHT=900
```

#### `VITE_DEV_PORT`
**Purpose:** Vite development server port

**Location:** `frontend_app/vite.config.ts` (line 30)

**Type:** Integer

**Default:** `5173`

**Examples:**
```env
VITE_DEV_PORT=5173  # Standard
VITE_DEV_PORT=3000  # Custom
```

#### `TAURI_DEV_URL`
**Purpose:** Dev URL for Tauri frontend distribution

**Location:** `frontend_app/src-tauri/tauri.conf.json`

**Default:** `http://localhost:5173`

**Examples:**
```env
TAURI_DEV_URL=http://localhost:5173
TAURI_DEV_URL=http://localhost:3000
```

#### `TAURI_API_HOSTS` (New)
**Purpose:** Allowed API hosts for Content Security Policy

**Location:** `frontend_app/src-tauri/tauri.conf.json` (CSP security policy)

**Type:** Comma-separated list

**Default:** `localhost:8000,localhost:9000`

**Usage in Security Policy:**
```json
"connect-src 'self' http://localhost:8000 http://localhost:9000 wss:"
```

**Examples:**
```env
# Development
TAURI_API_HOSTS=localhost:8000,localhost:9000

# Production
TAURI_API_HOSTS=api.yourdomain.com,broker.yourdomain.com
```

#### `TAURI_APP_IDENTIFIER`
**Purpose:** App identifier/bundle ID (com.company.appname format)

**Location:** `frontend_app/src-tauri/tauri.conf.json`

**Default:** `com.persona.ai.vices`

**Examples:**
```env
TAURI_APP_IDENTIFIER=com.persona.ai.vices
TAURI_APP_IDENTIFIER=com.yourcompany.personaai
```

---

## How Frontend Apps Load Configuration

### Web App (frontend/)

The React app reads `VITE_API_BASE_URL` via Vite's `import.meta.env`:

```typescript
import.meta.env.VITE_API_BASE_URL
```

**How to set it:**
1. Vite reads from `.env` or `.env.local` files in the frontend directory
2. Or set as system environment variable: `export VITE_API_BASE_URL=...`
3. Or pass during build: `VITE_API_BASE_URL=... npm run build`

### Tauri Desktop App (frontend_app/)

The React/Tauri app reads variables via `import.meta.env`:

```typescript
import.meta.env.VITE_BROKER_URL
process.env.DEV_TUNNEL_URL
```

**How to set it:**
1. Vite reads from `.env` or `.env.local` files in the frontend_app directory
2. Or use root `.env` file (recommended with setup script)
3. Or set as system environment variable
4. Or pass during build: `VITE_BROKER_URL=... pnpm build`

### Tauri Configuration (tauri.conf.json)

The `tauri.conf.json` configuration file references these variables but **must be manually updated** or generated from the `.env` file.

**Current Manual Values (that should come from .env):**
```json
{
  "productName": "Vices",  // Use TAURI_PRODUCT_NAME
  "build": {
    "devUrl": "http://localhost:5173",  // Use TAURI_DEV_URL
    "beforeDevCommand": "pnpm dev"
  },
  "app": {
    "windows": [{
      "title": "Vices Core",  // Use TAURI_WINDOW_TITLE
      "width": 800,  // Use TAURI_WINDOW_WIDTH
      "height": 600  // Use TAURI_WINDOW_HEIGHT
    }]
  }
}
```

---

## Setup Instructions

### For Development

#### 1. Add Frontend Variables to Root `.env`

```bash
cat > .env.local << 'EOF'
# Append to existing .env or create .env.local with:
VITE_API_BASE_URL=http://localhost:8000
VITE_BROKER_URL=http://localhost:9000
DEV_TUNNEL_URL=http://localhost:8000
EOF
```

#### 2. Create Symlink or Copy .env to Frontend Directories

**Option A: Copy to frontend directories**
```bash
cp .env frontend/.env
cp .env frontend_app/.env
```

**Option B: Create symlinks (Linux/Mac)**
```bash
ln -s ../../../.env frontend/.env
ln -s ../../../.env frontend_app/.env
```

**Option C: Frontend load from parent (recommended)**
```bash
# In frontend/vite.config.ts and frontend_app/vite.config.ts:
# Add: load_dotenv({ path: '../.env' })
```

#### 3. Start Development Servers

```bash
# Terminal 1: Backend
python app.py

# Terminal 2: Frontend web app
cd frontend && pnpm dev

# Terminal 3: Tauri desktop app
cd frontend_app && pnpm tauri dev
```

### For Production

#### 1. Set Environment Variables

```bash
export VITE_API_BASE_URL=https://api.yourdomain.com
export VITE_BROKER_URL=https://broker.yourdomain.com
export TAURI_PRODUCT_NAME=Vices
export TAURI_WINDOW_TITLE="Vices Core"
```

#### 2. Build Frontend

```bash
# Web app
cd frontend
VITE_API_BASE_URL=https://api.yourdomain.com pnpm build

# Tauri desktop app
cd frontend_app
VITE_API_BASE_URL=https://api.yourdomain.com pnpm tauri build
```

#### 3. Update tauri.conf.json for Production

```json
{
  "build": {
    "devUrl": "https://yourdomain.com"
  }
}
```

---

## Common Configuration Scenarios

### Scenario 1: Local Development

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_BROKER_URL=http://localhost:9000
DEV_TUNNEL_URL=http://localhost:8000
TAURI_WINDOW_WIDTH=800
TAURI_WINDOW_HEIGHT=600
```

### Scenario 2: Ngrok Tunnel Development (Remote)

```env
VITE_API_BASE_URL=https://abcd-123-456-789.ngrok-free.dev
VITE_BROKER_URL=http://localhost:9000
DEV_TUNNEL_URL=https://abcd-123-456-789.ngrok-free.dev
```

### Scenario 3: Production on Custom Domain

```env
VITE_API_BASE_URL=https://api.mydomain.com
VITE_BROKER_URL=https://broker.mydomain.com
DEV_TUNNEL_URL=https://mydomain.com
TAURI_WINDOW_WIDTH=1024
TAURI_WINDOW_HEIGHT=768
TAURI_WINDOW_TITLE=My AI Persona
```

### Scenario 4: Docker Production

```env
VITE_API_BASE_URL=http://backend:8000
VITE_BROKER_URL=http://broker:9000
DEV_TUNNEL_URL=http://backend:8000
```

---

## Accessing Variables in Frontend Code

### In React Components

```typescript
// Access in component
function MyComponent() {
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  const brokerUrl = import.meta.env.VITE_BROKER_URL;
  
  return <div>API: {apiUrl}</div>;
}
```

### In Vite Configuration

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    server: {
      proxy: {
        '/api': {
          target: env.DEV_TUNNEL_URL || 'http://localhost:8000'
        }
      }
    }
  }
})
```

### In Build Scripts

```bash
# Set at build time
VITE_API_BASE_URL=https://api.prod.com npm run build
```

---

## Verification Checklist

- [ ] Root `.env` file contains all frontend variables
- [ ] `config.py` imports all frontend variables
- [ ] `ENV_MAPPING.md` documents all frontend variables
- [ ] Frontend apps can read `import.meta.env.VITE_*` variables
- [ ] Local development uses `http://localhost:*` URLs
- [ ] Production build uses correct domain URLs
- [ ] Tauri desktop app connects to broker on correct port
- [ ] Web app connects to API on correct URL
- [ ] CSP security policy includes correct allowed hosts

---

## Troubleshooting

### Frontend can't reach backend

**Problem:** `CORS error` or `connection refused`

**Solution:**
1. Verify `VITE_API_BASE_URL` is correct: `echo $VITE_API_BASE_URL`
2. Check backend is running: `curl $VITE_API_BASE_URL/status`
3. Verify CORS headers in backend (`config.py: CORS_ALLOW_ORIGINS`)
4. Check firewall/network policies

### Environment variables not being read

**Problem:** Frontend shows wrong URL or uses default

**Solution:**
1. Restart dev server (changes to .env require restart)
2. Verify .env file exists: `ls -la .env`
3. Check syntax: `grep VITE_API_BASE_URL .env`
4. For build: `echo "VITE_API_BASE_URL=$VITE_API_BASE_URL"`

### Tauri window has wrong dimensions

**Problem:** Window is wrong size

**Solution:**
1. Edit `.env`: `TAURI_WINDOW_WIDTH=1024`
2. Rebuild: `pnpm tauri build`
3. Or manually edit `src-tauri/tauri.conf.json`

### Desktop app can't authenticate

**Problem:** Gatekeeper shows "Connection failed"

**Solution:**
1. Verify broker is running
2. Check `VITE_BROKER_URL`: `echo $VITE_BROKER_URL`
3. Test connection: `curl $VITE_BROKER_URL/health` (if endpoint exists)
4. Check firewall port 9000

---

## Next Steps

1. **Build Frontend:** Use updated configuration for your environment
2. **Deploy Frontend:** Push web app to hosting (Netlify, Vercel, etc.)
3. **Build Desktop:** Create installers with `pnpm tauri build`
4. **Monitor:** Track which frontend variables are used most often
5. **Optimize:** Consider which variables should be secrets vs. configuration

---

## Related Files

- `.env` - Main configuration file with frontend variables (sections 19-21)
- `config.py` - Python configuration loader (also loads frontend vars for reference)
- `ENV_MAPPING.md` - Complete reference of all variables including frontend
- `CONFIG_SETUP_GUIDE.md` - Setup guide includes frontend section
- `frontend/vite.config.ts` - Web app configuration
- `frontend_app/vite.config.ts` - Desktop app configuration  
- `frontend_app/src-tauri/tauri.conf.json` - Tauri configuration

