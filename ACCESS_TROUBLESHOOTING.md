# Access Denied Troubleshooting Guide

## Quick Summary of Fixes

### ✅ What Was Fixed

1. **Token Validation on Chat Endpoint** - The `/chat` endpoint now validates tokens to prevent unauthorized access
2. **Health Check Endpoint** - New `/health` endpoint on the broker allows real-time URL verification
3. **Live URL Validation in UI** - Desktop app now automatically checks if broker URL is reachable with live feedback
4. **Better Error Messages** - Users now get specific feedback about why access was denied

---

## Common Access Denied Issues & Solutions

### Issue 1: "Broker Unreachable" Error

**What This Means:**
- The URL you entered cannot be reached
- Either the Cloudflare tunnel is down, or the wrong URL was provided

**How to Fix:**
1. Copy the broker URL from the host again
2. Paste it into the Gatekeeper screen
3. **Wait for the green checkmark** before clicking Continue
4. If it stays red after 5 seconds:
   - The URL might be incorrect
   - The server might be offline
   - Contact the host and ask them to restart the server

**Example Correct URL:**
```
https://something-random-name.trycloudflare.com
```

❌ **Wrong formats:**
- `localhost:9000` (only works locally)
- `http://192.168.1.100:900` (port 900 is the tunnel entry, not the actual port)
- `https://your-ip:9000` (won't work through Cloudflare)

---

### Issue 2: "Invalid Token or Request Not Approved" Error

**What This Means:**
- You have a token, but it's:
  - Not yet approved by the admin
  - Expired
  - For a different server

**How to Fix:**

#### Option A: First Time Users (No Token Yet)

1. Click "Request Access" button
2. Enter your name
3. You'll get a `request_id`
4. Share this `request_id` with the server admin
5. Admin uses the admin dashboard to **approve your request** and generates a token
6. Once approved, the admin will give you a token
7. Use that token in the login screen

#### Option B: Have Token But Still Getting Denied

1. Make sure the token has no typos (copy-paste, don't type manually)
2. Ask the admin to verify the token is marked as "approved"
3. If token is old (>30 days), request a new one

---

### Issue 3: Cloudflare Tunnel Port Confusion

**Understanding Ports:**

```
User connects to:          → Cloudflare Tunnel maps to:
https://xxx.trycloudflare.com:443    → Your broker (port 9000)

The Cloudflare tunnel automatically:
- Handles SSL/HTTPS
- Forwards to backend port 9000
- Adds necessary headers for proper routing
```

**What NOT to do:**
```
❌ https://xxx.trycloudflare.com:900   (port 900 is for ngrok, not CF)
❌ https://xxx.trycloudflare.com:9000  (port already included in tunnel)
```

**What TO do:**
```
✅ https://xxx.trycloudflare.com      (exactly as given by host)
```

---

## Admin Approval Workflow

### For Server Admins/Hosts:

**Step 1: User requests access**
```
User fills "Request Access" form with their name
→ Gets a request_id (e.g., a1b2c3d4-e5f6...)
```

**Step 2: You approve in admin dashboard**
```
1. Open admin dashboard
2. Find the pending request with the user's name
3. Click "Approve" 
4. A token is generated automatically (or you can provide a custom one)
5. Share the token with the user
```

**Step 3: User logs in with token**
```
User enters the token in the Gatekeeper login screen
→ Authenticates and gets access
```

---

## Testing Broker Connectivity

### Quick Health Check

The app now has a `GET /health` endpoint on the broker. It returns:

```json
{
  "status": "healthy",
  "message": "Broker is online and accepting connections",
  "broker_port": 9000,
  "api_endpoint": "https://your-api-tunnel.trycloudflare.com"
}
```

**To test manually (in browser):**
```
https://your-broker-tunnel.trycloudflare.com/health
```

If you see the JSON response above, the broker is healthy and reachable.

---

## Token Validation Details

### How Tokens Are Validated

The system checks:

1. **Token is not empty** ✓
2. **Token is approved** ✓ (status = "approved" in database)
3. **Token matches format** ✓ (starts with `vx_` for auto-generated, or custom format)

If any check fails → "Invalid token" error

### MASTER_TOKEN Bypass (For Developers)

In `.env`, if you set:
```env
MASTER_TOKEN=my-secret-dev-key
```

Then you can use `my-secret-dev-key` as a token and it will always work (for testing).

---

## Enhanced Error Messages

The updated system now provides specific guidance:

| Error | Reason | Solution |
|-------|--------|----------|
| "No token provided" | Forgot to enter token | Enter your token in the login field |
| "Invalid or unrecognized token" | Token not approved yet | Ask admin to approve your access request |
| "Broker unreachable" | URL is invalid or server is down | Check URL format, ask host to restart server |
| "Timeout" | Server not responding | Network issue or server offline for >5 seconds |

---

## Network Requirements

**For users to access the server:**

1. **Cloudflare tunnel must be running** on the host
   ```bash
   cloudflare-tunnel run --creds-file <path>
   ```

2. **Backend server must be running**
   ```bash
   python server.py
   ```
   
   This starts TWO servers:
   - Port 8000: Main API (chat, events, etc.)
   - Port 9000: Broker (authentication, request approval, health checks)

3. **Cloudflare tunnel configuration must map port 9000**
   ```bash
   cloudflare tunnel route dns <tunnel-name> <domain>
   # And ensure the tunnel forwards to both ports
   ```

---

## Logging & Debugging

### Check Server Logs for Access Issues

When someone reports "access denied", check:

```python
# In server.py logs, you'll see:
# ✓ POST /request-waitlist - Request created (pending)
# ✓ POST /admin/approve - Token generated and approved
# ✓ POST /request-access - Token validated successfully
# ✗ POST /request-access - Invalid token (if access denied)
# ✗ POST /chat - No token provided (if chat access denied)
```

---

## Environment Variables Reference

```env
# Broker Configuration
VITE_BROKER_URL=https://your-broker-tunnel.trycloudflare.com
CURRENT_RUNTIME_TUNNEL=https://your-api-tunnel.trycloudflare.com

# Admin Settings
ADMIN_PASSWORD=your-strong-password          # Required for admin dashboard
MASTER_TOKEN=dev-key-only-for-testing       # Optional, for development bypass

# Storage Paths
REQUEST_STORAGE_PATH=access_requests.json    # Where access requests are stored
APPROVED_TOKENS_PATH=approved_tokens.json    # Token whitelist
```

---

## Summary Checklist

Before asking for help, verify:

- [ ] Broker URL is exact (no typos, no port suffix)
- [ ] Broker URL passes the green checkmark in Gatekeeper
- [ ] Token is copied exactly (no spaces, full string)
- [ ] Token was approved by admin (check admin dashboard)
- [ ] Cloudflare tunnel is running on host machine
- [ ] Backend server (server.py) is running
- [ ] Network connection is stable (no VPN blocking)
- [ ] Browser isn't blocking cookies/storage (if using web app)

If all checks pass and you still get access denied, [check server logs](#logging--debugging).

---

**Last Updated:** March 2026
**Version:** 2.0 (with real-time URL validation)
