import {
  toCodeAssistRequest,
  normalizeAntigravityModelId,
  withClaudeCodeIdentity,
  GOOGLE_ENTERPRISE_CLOUD_CODE_PROJECT,
  type CodeAssistContent,
  type CodeAssistGenerateRequest,
  type SystemBlock,
} from '@flyvendedk799/ai-auth';
import type { Wire, ResolvedProvider } from './resolve.js';

export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAiRequest {
  model: string;
  messages: OpenAiMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
}

export interface OpenAiChoice {
  index: number;
  message: { role: 'assistant'; content: string };
  finish_reason: string | null;
}

export interface OpenAiResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAiChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface OpenAiStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: 'assistant'; content?: string };
    finish_reason: string | null;
  }>;
}

function openAiToGeminiContents(messages: OpenAiMessage[]): {
  contents: CodeAssistContent[];
  systemInstruction?: string;
} {
  let systemInstruction: string | undefined;
  const contents: CodeAssistContent[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = systemInstruction
        ? `${systemInstruction}\n\n${msg.content}`
        : msg.content;
      continue;
    }
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }
  return { contents, systemInstruction };
}

export function buildGeminiSubscriptionRequest(
  model: string,
  messages: OpenAiMessage[],
  projectId?: string,
): CodeAssistGenerateRequest {
  const { contents, systemInstruction } = openAiToGeminiContents(messages);
  return toCodeAssistRequest(model, contents, {
    projectId: projectId ?? GOOGLE_ENTERPRISE_CLOUD_CODE_PROJECT,
    systemInstruction,
  });
}

export function buildGeminiKeyRequest(
  model: string,
  messages: OpenAiMessage[],
): { contents: CodeAssistContent[]; systemInstruction?: { parts: Array<{ text: string }> } } {
  const { contents, systemInstruction } = openAiToGeminiContents(messages);
  return {
    contents,
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export function geminiResponseToOpenAi(
  body: GeminiResponse,
  model: string,
  requestId: string,
): OpenAiResponse {
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const finishReason = body.candidates?.[0]?.finishReason ?? 'stop';

  return {
    id: requestId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: finishReason === 'STOP' ? 'stop' : finishReason.toLowerCase(),
      },
    ],
    usage: body.usageMetadata
      ? {
          prompt_tokens: body.usageMetadata.promptTokenCount ?? 0,
          completion_tokens: body.usageMetadata.candidatesTokenCount ?? 0,
          total_tokens: body.usageMetadata.totalTokenCount ?? 0,
        }
      : undefined,
  };
}

export function geminiUrl(provider: ResolvedProvider, model: string): string {
  const base = provider.baseURL.replace(/\/$/, '');
  if (provider.isSubscription) {
    return `${base}:generateContent`;
  }
  return `${base}/models/${model}:generateContent`;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string | SystemBlock[];
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  stream?: boolean;
}

export function buildAnthropicRequest(
  model: string,
  messages: OpenAiMessage[],
  maxTokens: number,
  isSubscription: boolean,
): AnthropicRequest {
  let systemText = '';
  const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText = systemText ? `${systemText}\n\n${msg.content}` : msg.content;
      continue;
    }
    anthropicMessages.push({ role: msg.role, content: msg.content });
  }

  const system = isSubscription
    ? withClaudeCodeIdentity(systemText || 'You are a helpful assistant.')
    : systemText || undefined;

  return {
    model,
    max_tokens: maxTokens,
    ...(system !== undefined ? { system } : {}),
    messages: anthropicMessages,
  };
}

interface AnthropicResponse {
  id?: string;
  content?: Array<{ type: string; text?: string }>;
  model?: string;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export function anthropicResponseToOpenAi(
  body: AnthropicResponse,
  model: string,
  requestId: string,
): OpenAiResponse {
  const text =
    body.content
      ?.filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('') ?? '';

  return {
    id: requestId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: body.model ?? model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: body.stop_reason === 'end_turn' ? 'stop' : (body.stop_reason ?? 'stop'),
      },
    ],
    usage: body.usage
      ? {
          prompt_tokens: body.usage.input_tokens ?? 0,
          completion_tokens: body.usage.output_tokens ?? 0,
          total_tokens: (body.usage.input_tokens ?? 0) + (body.usage.output_tokens ?? 0),
        }
      : undefined,
  };
}

export function anthropicUrl(provider: ResolvedProvider): string {
  return `${provider.baseURL.replace(/\/$/, '')}/v1/messages`;
}

export function openAiUrl(provider: ResolvedProvider): string {
  return `${provider.baseURL.replace(/\/$/, '')}/v1/chat/completions`;
}

export function openAiResponsePassthrough(
  body: Record<string, unknown>,
  requestId: string,
): OpenAiResponse {
  return { ...body, id: requestId } as unknown as OpenAiResponse;
}

let counter = 0;
export function generateRequestId(): string {
  return `chatcmpl-proxy-${Date.now()}-${++counter}`;
}
