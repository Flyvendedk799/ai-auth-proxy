import { toCodeAssistRequest, withClaudeCodeIdentity, GOOGLE_ENTERPRISE_CLOUD_CODE_PROJECT, } from '@flyvendedk799/ai-auth';
function openAiToGeminiContents(messages) {
    let systemInstruction;
    const contents = [];
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
export function buildGeminiSubscriptionRequest(model, messages, projectId) {
    const { contents, systemInstruction } = openAiToGeminiContents(messages);
    return toCodeAssistRequest(model, contents, {
        projectId: projectId ?? GOOGLE_ENTERPRISE_CLOUD_CODE_PROJECT,
        systemInstruction,
    });
}
export function buildGeminiKeyRequest(model, messages) {
    const { contents, systemInstruction } = openAiToGeminiContents(messages);
    return {
        contents,
        ...(systemInstruction
            ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
            : {}),
    };
}
export function geminiResponseToOpenAi(body, model, requestId) {
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
export function geminiUrl(provider, model) {
    const base = provider.baseURL.replace(/\/$/, '');
    if (provider.isSubscription) {
        return `${base}:generateContent`;
    }
    return `${base}/models/${model}:generateContent`;
}
export function buildAnthropicRequest(model, messages, maxTokens, isSubscription) {
    let systemText = '';
    const anthropicMessages = [];
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
export function anthropicResponseToOpenAi(body, model, requestId) {
    const text = body.content
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
export function anthropicUrl(provider) {
    return `${provider.baseURL.replace(/\/$/, '')}/v1/messages`;
}
export function openAiUrl(provider) {
    return `${provider.baseURL.replace(/\/$/, '')}/v1/chat/completions`;
}
export function openAiResponsePassthrough(body, requestId) {
    return { ...body, id: requestId };
}
let counter = 0;
export function generateRequestId() {
    return `chatcmpl-proxy-${Date.now()}-${++counter}`;
}
