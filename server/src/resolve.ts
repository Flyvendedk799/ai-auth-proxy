import {
  ClaudeCodeCredential,
  CodexCredential,
  AntigravityCliCredential,
  anthropicSubscriptionOptions,
  anthropicKeyOptions,
  codexOptions,
  antigravityCliOptions,
  antigravityKeyOptions,
  openAiKeyOptions,
  CLOUD_CODE_DAILY_BASE_URL,
  antigravity_STUDIO_BASE_URL,
  CODEX_BASE_URL,
} from '@flyvendedk799/ai-auth';

// Also import the stores managed by the UI
import { claudeAccounts, antigravityAccounts } from './stores.js';

export type Wire = 'anthropic' | 'openai' | 'gemini';

export interface ResolvedProvider {
  wire: Wire;
  baseURL: string;
  headers: Record<string, string>;
  isSubscription: boolean;
  source: string;
}

export function wireForModel(model: string): Wire {
  if (model.startsWith('claude') || model.startsWith('proxy-claude')) return 'anthropic';
  if (model.startsWith('gemini') || model.startsWith('proxy-gemini')) return 'gemini';
  return 'openai';
}

function envKey(wire: Wire): string | undefined {
  const names: Record<Wire, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
  };
  return process.env[names[wire]] || undefined;
}

const claude = new ClaudeCodeCredential();
const codex = new CodexCredential();
const antigravity = new AntigravityCliCredential();

export async function resolveProvider(model: string): Promise<ResolvedProvider> {
  const wire = wireForModel(model);

  if (wire === 'gemini') {
    // 2. Try CLI credential
    try {
      const identity = await antigravity.identity();
      const opts = antigravityCliOptions(identity);
      return {
        wire: 'gemini',
        baseURL: opts.baseURL ?? CLOUD_CODE_DAILY_BASE_URL,
        headers: opts.defaultHeaders ?? {},
        isSubscription: true,
        source: `gemini-cli (${identity.email ?? 'local'})`,
      };
    } catch { }

    // 1. Try UI-managed account
    try {
      const status = await antigravityAccounts.status('local-user');
      if (status.connected) {
        const token = await antigravityAccounts.token('local-user');
        const opts = antigravityCliOptions({ accessToken: token, refreshToken: null, expiresAt: 0, email: status.email });
        return {
          wire: 'gemini',
          baseURL: opts.baseURL ?? CLOUD_CODE_DAILY_BASE_URL,
          headers: opts.defaultHeaders ?? {},
          isSubscription: true,
          source: `gemini-ui (${status.email ?? 'local'})`,
        };
      }
    } catch { }

    // 3. API Key
    const key = envKey('gemini');
    if (key) {
      return {
        wire: 'gemini',
        baseURL: antigravity_STUDIO_BASE_URL,
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        isSubscription: false,
        source: 'gemini-api-key',
      };
    }
    throw new Error('No Gemini credential available. Sign in through the UI, use `agy login`, or set GEMINI_API_KEY.');
  }

  if (wire === 'anthropic') {
    // 1. UI
    try {
      const status = await claudeAccounts.status('local-user');
      if (status.connected) {
        const token = await claudeAccounts.token('local-user');
        const opts = anthropicSubscriptionOptions(token);
        return {
          wire: 'anthropic',
          baseURL: 'https://api.anthropic.com',
          headers: { Authorization: `Bearer ${token}`, ...(opts.defaultHeaders ?? {}) },
          isSubscription: true,
          source: `claude-ui (${status.plan ?? 'local'})`,
        };
      }
    } catch { }

    // 2. CLI
    try {
      const token = await claude.token();
      const opts = anthropicSubscriptionOptions(token);
      return {
        wire: 'anthropic',
        baseURL: 'https://api.anthropic.com',
        headers: { Authorization: `Bearer ${token}`, ...(opts.defaultHeaders ?? {}) },
        isSubscription: true,
        source: 'claude-cli',
      };
    } catch { }

    const key = envKey('anthropic');
    if (key) {
      return {
        wire: 'anthropic',
        baseURL: 'https://api.anthropic.com',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        isSubscription: false,
        source: 'anthropic-api-key',
      };
    }
    throw new Error('No Anthropic credential available.');
  }

  // OpenAI (Codex / key)
  try {
    const identity = await codex.identity();
    const opts = codexOptions(identity);
    return {
      wire: 'openai',
      baseURL: opts.baseURL ?? CODEX_BASE_URL,
      headers: { Authorization: `Bearer ${identity.accessToken}`, ...(opts.defaultHeaders ?? {}) },
      isSubscription: true,
      source: `codex (${identity.email ?? identity.planType ?? 'local'})`,
    };
  } catch { }

  const key = envKey('openai');
  if (key) {
    return {
      wire: 'openai',
      baseURL: 'https://api.openai.com',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      isSubscription: false,
      source: 'openai-api-key',
    };
  }
  throw new Error('No OpenAI credential available.');
}
