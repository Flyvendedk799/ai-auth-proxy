import { toCodeAssistRequest, withClaudeCodeIdentity, GOOGLE_ENTERPRISE_CLOUD_CODE_PROJECT, } from '@flyvendedk799/ai-auth';
function sanitizeSchema(obj) {
    if (!obj || typeof obj !== 'object')
        return obj;
    if (Array.isArray(obj))
        return obj.map(sanitizeSchema);
    const newObj = {};
    for (const key in obj) {
        if (key === '$schema' || key === 'additionalProperties' || key === 'default' || key === 'const' || key === 'exclusiveMinimum' || key === 'propertyNames' || key === 'anyOf' || key === 'allOf' || key === 'oneOf' || key === 'not' || key === 'patternProperties')
            continue;
        newObj[key] = sanitizeSchema(obj[key]);
    }
    return newObj;
}
function openAiToGeminiTools(tools) {
    if (!tools || tools.length === 0)
        return undefined;
    const functionDeclarations = tools
        .filter(t => t.type === 'function' && t.function)
        .map(t => sanitizeSchema(t.function));
    if (functionDeclarations.length === 0)
        return undefined;
    return [{ functionDeclarations }];
}
function openAiToGeminiContents(messages) {
    let systemInstruction;
    const contents = [];
    for (const msg of messages) {
        let textContent = '';
        if (typeof msg.content === 'string') {
            textContent = msg.content;
        }
        else if (Array.isArray(msg.content)) {
            textContent = msg.content
                .filter((part) => part.type === 'text')
                .map((part) => part.text)
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
        let newParts = [];
        if (msg.role === 'tool' || msg.role === 'function') {
            const isLegacy = !msg.tool_call_id || !msg.tool_call_id.includes('__sig__');
            if (isLegacy) {
                newParts.push({
                    text: `[Tool ${msg.name || 'tool'} returned: ${textContent}]`
                });
            }
            else {
                newParts.push({
                    functionResponse: {
                        name: msg.name || 'tool',
                        response: { result: textContent }
                    }
                });
            }
        }
        else if (msg.tool_calls && msg.tool_calls.length > 0) {
            if (textContent)
                newParts.push({ text: textContent });
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
                }
                else {
                    // Old tool call from history without a signature. Gemini will reject it if we use functionCall.
                    // Convert to text to preserve context without breaking the API.
                    newParts.push({
                        text: `[Model invoked tool: ${call.function.name} with args: ${call.function.arguments}]`
                    });
                }
            }
        }
        else {
            if (textContent)
                newParts.push({ text: textContent });
        }
        if (newParts.length === 0) {
            newParts.push({ text: 'OK' });
        }
        if (lastContent && lastContent.role === mappedRole) {
            if (!lastContent.parts)
                lastContent.parts = [];
            lastContent.parts.push(...newParts);
        }
        else {
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
export function buildGeminiSubscriptionRequest(model, messages, projectId, tools, maxTokens, temperature, topP) {
    const { contents, systemInstruction } = openAiToGeminiContents(messages);
    const req = toCodeAssistRequest(model, contents, {
        projectId: projectId ?? GOOGLE_ENTERPRISE_CLOUD_CODE_PROJECT,
        systemInstruction,
    });
    req.request.generationConfig = {
        ...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
        ...(temperature !== undefined ? { temperature: temperature } : {}),
        ...(topP !== undefined ? { topP: topP } : {}),
    };
    const geminiTools = openAiToGeminiTools(tools);
    if (geminiTools) {
        req.request.tools = geminiTools;
    }
    return req;
}
export function buildGeminiKeyRequest(model, messages, tools, maxTokens, temperature, topP) {
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
export function geminiResponseToOpenAi(body, model, requestId) {
    const candidates = body.candidates ?? body.response?.candidates;
    const usageMetadata = body.usageMetadata ?? body.response?.usageMetadata;
    const parts = candidates?.[0]?.content?.parts ?? [];
    const text = parts.find(p => p.text)?.text ?? '';
    const functionCallPart = parts.find(p => p.functionCall);
    let tool_calls = [];
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
export function geminiUrl(provider, model, stream = false) {
    const base = provider.baseURL.replace(/\/$/, '');
    if (provider.isSubscription) {
        return `${base}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
    }
    return `${base}/models/${model}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
}
export function buildAnthropicRequest(model, messages, maxTokens, isSubscription) {
    let systemText = '';
    const anthropicMessages = [];
    for (const msg of messages) {
        let textContent = '';
        if (typeof msg.content === 'string') {
            textContent = msg.content;
        }
        else if (Array.isArray(msg.content)) {
            textContent = msg.content
                .filter((part) => part.type === 'text')
                .map((part) => part.text)
                .join('\n');
        }
        if (msg.role === 'system') {
            systemText = systemText ? `${systemText}\n\n${textContent}` : textContent;
            continue;
        }
        const mappedRole = (msg.role === 'tool' || msg.role === 'function') ? 'user' : msg.role;
        anthropicMessages.push({ role: mappedRole, content: textContent });
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
