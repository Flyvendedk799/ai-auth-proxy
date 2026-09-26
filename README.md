# ai-auth-proxy

A local OpenAI-compatible proxy and web dashboard that routes your AI traffic through your active enterprise subscriptions (Gemini, Claude, Codex) via the [`@flyvendedk799/ai-auth`](https://github.com/Flyvendedk799/ai-auth) library.

Perfect for routing the **Cursor IDE** (or any BYOK AI app) through your existing developer subscriptions, bypassing pay-per-token API costs.

## Features

- **OpenAI-Compatible Endpoint**: Drop-in replacement for OpenAI endpoints (listens on `http://127.0.0.1:4141/v1`).
- **Advanced Payload Translation**: Flawlessly translates complex OpenAI agentic payloads—including tool calls, streaming chunks, and Gemini 3.1 thought signatures—into native Google/Anthropic formats.
- **Web Dashboard**: A React UI to easily connect and disconnect your accounts without touching the CLI.
- **Hybrid Resolution**: Automatically falls back to API keys in your environment if a local subscription is not found.

## Quickstart

### 1. Install & Run
Clone the repository and install dependencies:
```bash
git clone https://github.com/Flyvendedk799/ai-auth-proxy.git
cd ai-auth-proxy
npm install
npm run build
npm start
```

This will start the proxy on port `4141` and automatically open the web dashboard in your browser.

### 2. Connect Your Accounts
In the web dashboard (`http://localhost:4141`), click "Connect" on the providers you wish to use (e.g., Gemini) and complete the OAuth flow.

### 3. Configure Cursor
In Cursor, go to **Settings > Models > OpenAI**:
1. Set the **OpenAI Base URL** to: `http://127.0.0.1:4141/v1`
2. Set the **API Key** to any dummy value (e.g., `dummy`).
3. Add custom model names to Cursor (e.g., `proxy-gemini-3.1-pro`) and toggle them on.

*Note: The `proxy-` prefix prevents Cursor from blocking the request when it collides with its own native backend models.*

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
