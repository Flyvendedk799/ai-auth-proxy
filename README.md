# ai-auth-proxy

A local OpenAI-compatible proxy and web dashboard that routes your AI traffic through your active enterprise subscriptions (Gemini, Claude, Codex) via the [`@flyvendedk799/ai-auth`](https://github.com/Flyvendedk799/ai-auth) library.

Perfect for routing the **Cursor IDE** (or any BYOK AI app) through your existing developer subscriptions, bypassing pay-per-token API costs.

## Features

- **OpenAI-Compatible Endpoint**: Drop-in replacement for OpenAI endpoints (listens on `http://127.0.0.1:4141/v1`).
- **Cloudflare Tunneling**: Built-in support to expose the local proxy via a public `trycloudflare.com` URL (required for strict clients like Cursor).
- **Advanced Payload Translation**: Flawlessly translates complex OpenAI agentic payloads�including tool calls, streaming chunks, and Gemini schema quirks�into native Google/Anthropic formats.
- **Web Dashboard**: A React UI to easily connect and disconnect your accounts without touching the CLI.
- **Hybrid Resolution**: Automatically falls back to API keys in your environment if a local subscription is not found.

## Quickstart

### 1. Install & Run (Fastest Way)
Clone the repository and run the setup script. This will automatically install all server and UI dependencies, build the dashboard, and start the proxy with a Cloudflare tunnel.

**On Windows:**
Double-click `start.bat` or run:
```powershell
.\start.ps1
```

**On Mac/Linux:**
```bash
npm run setup
npm run dev:tunnel
```

The console will print a public Cloudflare Tunnel URL (e.g., `https://random-words.trycloudflare.com`). **Copy this URL!**

### 2. Connect Your Accounts
The server will automatically open the web dashboard in your browser at `http://127.0.0.1:4141`.
Click **Connect** on the providers you wish to use (e.g., Gemini) and complete the OAuth flow.

### 3. Configure Cursor
Because Cursor's URL validator often rejects `127.0.0.1`, you must use the public Cloudflare Tunnel URL.

In Cursor, go to **Settings > Models > OpenAI**:
1. Set the **OpenAI Base URL** to your tunnel URL with `/v1` appended:
   `https://random-words.trycloudflare.com/v1`
2. Set the **API Key** to any dummy value (e.g., `dummy`).
3. Add custom model names to Cursor (e.g., `gemini-3.1-pro`) and toggle them on.

## Development

The project is split into two parts:
- `server/`: The Fastify/Node proxy and translation layer.
- `ui/`: The Vite/React dashboard.

To run in development mode with hot-reloading:
```bash
# Terminal 1: Run the proxy server
npm run dev

# Terminal 2: Run the React UI
cd ui
npm run dev
```
