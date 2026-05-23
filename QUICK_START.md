# Quick Start Guide - Accessing Persona-AI

## For Your Friend (New User)

### Step 1: Get the Broker URL
Ask the host for their **Broker URL** (looks like):
```
https://something-cloudflare-tunnel.trycloudflare.com
```

### Step 2: Open the Desktop App
The VICES desktop app will show two screens:

### Screen 1: Enter Broker URL
1. Paste the broker URL they gave you
2. **Wait for the green checkmark** to appear (means server is reachable)
3. Click "Continue"

**If you see a red X:**
- The URL might be wrong → ask the host again
- The server might be offline → ask host to restart
- Network issue → check your internet

### Screen 2: Login with Token
1. Ask the host for your **Access Token** (long random string starting with `vx_`)
2. Paste it in the token field
3. Click "Connect to Core"

**If you get "Access Denied":**
- Token not yet approved → host needs to approve it in admin dashboard
- Token is old → request a new one
- Wrong broker URL → go back and re-enter

### Step 3: Done!
Once authenticated, you'll see the chat interface. Start typing!

---

## For the Host (Admin)

### Approving New Users

1. **User requests access:**
   - They click "Request Access" in the desktop app
   - They enter their name
   - They get a `request_id`

2. **You approve in admin dashboard:**
   - Access the admin dashboard (URL from server logs)
   - Enter your admin password
   - Find the pending request with their name
   - Click "Approve"
   - A token is automatically generated

3. **Send them the token:**
   - Share the generated token with the user
   - They paste it into the login screen

### Troubleshooting User Access Issues

**"Broker unreachable" error:**
- Make sure your Cloudflare tunnel is running
- Verify the tunnel URL matches what you gave them
- Restart the tunnel: `cloudflare-tunnel run --creds-file <path>`

**"Invalid token" error:**
- Verify the token is marked as "approved" in your admin dashboard
- Give them a fresh token (generate a new one)

**Everything works but user still can't access:**
- Check if `server.py` is still running
- Restart the backend: `python server.py`

---

## What's New (Version 2.0)

✅ **Live URL Validation** - App checks if broker is reachable before you login
✅ **Better Error Messages** - Know exactly why access was denied
✅ **Health Check Endpoint** - `/health` endpoint to verify broker status
✅ **Token Security** - Chat endpoint now requires valid tokens

---

## Troubleshooting Checklist

If access is denied:

- [ ] URL shows a **green checkmark** (broker is reachable)
- [ ] Token is **exactly correct** (copy-paste, not typed)
- [ ] Token has been **approved by admin** (check admin dashboard)
- [ ] Server is **still running** (check host logs)
- [ ] Cloudflare tunnel is **still running** (ask host to restart if needed)

---

## Common Issues & Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| Red X next to URL | Broker offline or wrong URL | Ask host for correct URL, they restart server |
| "Access Denied" after valid token | Token not approved | Ask host to approve in admin dashboard |
| "Timeout" error | Network too slow | Check WiFi connection, try again |
| Login works but chat fails | Session expired | Restart desktop app, login again |

---

## Getting Help

If you're stuck:

1. **Check the troubleshooting guide:** `ACCESS_TROUBLESHOOTING.md`
2. **Ask the host to check:**
   - Is `server.py` running?
   - Is Cloudflare tunnel running?
   - Is the token actually approved?
3. **Share with host:**
   - The exact error message you see
   - The broker URL you're using
   - Your token (so they can verify it's approved)

---

**Version:** 2.0
**Last Updated:** March 2026
