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
  role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
  content?: string | any[];
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  function_call?: any;
}

export interface OpenAiRequest {
  model: string;
  messages: OpenAiMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
  tools?: any[];
  tool_choice?: any;
}

export interface OpenAiChoice {
  index: number;
  message: { role: 'assistant'; content: string; tool_calls?: any[] };
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
    delta: { role?: 'assistant'; content?: string; tool_calls?: any[] };
    finish_reason: string | null;
  }>;
}

function sanitizeSchema(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeSchema);
  const newObj: any = {};
  for (const key in obj) {
    if (key === '$schema' || key === 'additionalProperties' || key === 'default' || key === 'const' || key === 'exclusiveMinimum') continue;
    newObj[key] = sanitizeSchema(obj[key]);
  }
  return newObj;
}

function openAiToGeminiTools(tools?: any[]): any[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  
  const functionDeclarations = tools
    .filter(t => t.type === 'function' && t.function)
    .map(t => sanitizeSchema(t.function));
    
  if (functionDeclarations.length === 0) return undefined;
  
  return [{ functionDeclarations }];
}

function openAiToGeminiContents(messages: OpenAiMessage[]): {
  contents: CodeAssistContent[];
  systemInstruction?: string;
} {
  let systemInstruction: string | undefined;
  const contents: CodeAssistContent[] = [];

  for (const msg of messages) {
    let textContent = '';
    if (typeof msg.content === 'string') {
      textContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      textContent = msg.content
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('\n');
    }

    if (msg.role === 'system') {
      systemInstruction = systemInstruction
        ? `${systemInstruction}\n\n${textContent}`
        : textContent;
      continue;
    }

    const mappedRole = msg.role === 'assistant' ? 'model' : 'user';
    const lastContent = contents[contents.length - 1];

    let newParts: any[] = [];
    if (msg.role === 'tool' || msg.role === 'function') {
      const isLegacy = !msg.tool_call_id || !msg.tool_call_id.includes('__sig__');
      
      if (isLegacy) {
        newParts.push({
          text: `[Tool ${msg.name || 'tool'} returned: ${textContent}]`
        });
      } else {
        newParts.push({
          functionResponse: {
            name: msg.name || 'tool',
            response: { result: textContent }
          }
        });
      }
    } else if (msg.tool_calls && msg.tool_calls.length > 0) {
      if (textContent) newParts.push({ text: textContent });
      for (const call of msg.tool_calls) {
        const idParts = call.id.split('__sig__');
        const sig = idParts.length > 1 ? idParts[1] : undefined;
        
        if (sig) {
          newParts.push({
            thoughtSignature: sig,
            functionCall: {
              name: call.function.name,
              args: typeof call.function.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function.arguments
            }
          });
        } else {
          // Old tool call from history without a signature. Gemini will reject it if we use functionCall.
          // Convert to text to preserve context without breaking the API.
          newParts.push({
            text: `[Model invoked tool: ${call.function.name} with args: ${call.function.arguments}]`
          });
        }
      }
    } else {
      if (textContent) newParts.push({ text: textContent });
    }

    if (newParts.length === 0) {
      newParts.push({ text: 'OK' });
    }

    if (lastContent && lastContent.role === mappedRole) {
      if (!lastContent.parts) lastContent.parts = [];
      lastContent.parts.push(...newParts);
    } else {
      contents.push({
        role: mappedRole,
        parts: newParts,
      });
    }
  }

  // Gemini requires the first message to be 'user'
  if (contents.length > 0 && contents[0]?.role === 'model') {
    contents.unshift({ role: 'user', parts: [{ text: '(Empty prompt to satisfy alternating roles)' }] });
  }

  return { contents, systemInstruction };
}

export function buildGeminiSubscriptionRequest(
  model: string,
  messages: OpenAiMessage[],
  projectId?: string,
  tools?: any[],
): any {
  const { contents, systemInstruction } = openAiToGeminiContents(messages);
  const req = toCodeAssistRequest(model, contents, {
    projectId: projectId ?? GOOGLE_ENTERPRISE_CLOUD_CODE_PROJECT,
    systemInstruction,
  });
  
  const geminiTools = openAiToGeminiTools(tools);
  if (geminiTools) {
    (req.request as any).tools = geminiTools;
  }
  
  return req;
}

export function buildGeminiKeyRequest(
  model: string,
  messages: OpenAiMessage[],
  tools?: any[],
): any {
  const { contents, systemInstruction } = openAiToGeminiContents(messages);
  const geminiTools = openAiToGeminiTools(tools);
  
  return {
    contents,
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
    ...(geminiTools ? { tools: geminiTools } : {})
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thoughtSignature?: string; functionCall?: { name: string; args: any } }> };
    finishReason?: string;
  }>;
  response?: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thoughtSignature?: string; functionCall?: { name: string; args: any } }> };
      finishReason?: string;
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
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
  const candidates = body.candidates ?? body.response?.candidates;
  const usageMetadata = body.usageMetadata ?? body.response?.usageMetadata;

  const parts = candidates?.[0]?.content?.parts ?? [];
  const text = parts.find(p => p.text)?.text ?? '';
  const functionCallPart = parts.find(p => p.functionCall);
  
  let tool_calls: any[] = [];
  if (functionCallPart?.functionCall) {
    const sig = functionCallPart.thoughtSignature || '';
    const baseId = `call_${Math.random().toString(36).substr(2, 9)}`;
    const id = sig ? `${baseId}__sig__${sig}` : baseId;
    
    tool_calls.push({
      id,
      type: 'function',
      function: {
        name: functionCallPart.functionCall.name,
        arguments: typeof functionCallPart.functionCall.args === 'string' 
          ? functionCallPart.functionCall.args 
          : JSON.stringify(functionCallPart.functionCall.args || {})
      }
    });
  }

  const finishReason = candidates?.[0]?.finishReason ?? 'stop';

  return {
    id: requestId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { 
          role: 'assistant', 
          content: text,
          ...(tool_calls.length > 0 ? { tool_calls } : {})
        },
        finish_reason: tool_calls.length > 0 ? 'tool_calls' : (finishReason === 'STOP' ? 'stop' : finishReason.toLowerCase()),
      },
    ],
    usage: usageMetadata
      ? {
          prompt_tokens: usageMetadata.promptTokenCount ?? 0,
          completion_tokens: usageMetadata.candidatesTokenCount ?? 0,
          total_tokens: usageMetadata.totalTokenCount ?? 0,
        }
      : undefined,
  };
}

export function geminiUrl(provider: ResolvedProvider, model: string, stream: boolean = false): string {
  const base = provider.baseURL.replace(/\/$/, '');
  if (provider.isSubscription) {
    return `${base}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
  }
  return `${base}/models/${model}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
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
    let textContent = '';
    if (typeof msg.content === 'string') {
      textContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      textContent = msg.content
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('\n');
    }

    if (msg.role === 'system') {
      systemText = systemText ? `${systemText}\n\n${textContent}` : textContent;
      continue;
    }
    
    const mappedRole = (msg.role === 'tool' || msg.role === 'function') ? 'user' : msg.role;
    anthropicMessages.push({ role: mappedRole as 'user' | 'assistant', content: textContent });
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
