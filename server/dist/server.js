import Fastify from 'fastify';
import { claudeAuthRoutes, antigravityAuthRoutes } from '@flyvendedk799/ai-auth/fastify';
import { resolveProvider } from './resolve.js';
import { buildGeminiSubscriptionRequest, buildGeminiKeyRequest, buildAnthropicRequest, geminiResponseToOpenAi, anthropicResponseToOpenAi, openAiResponsePassthrough, geminiUrl, anthropicUrl, openAiUrl, generateRequestId, } from './translate.js';
import { claudeAccounts, antigravityAccounts } from './stores.js';
import { join } from 'node:path';
export async function createServer() {
    const app = Fastify({ logger: false });
    // Add CORS
    app.options('/*', async (request, reply) => {
        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return reply.send();
    });
    app.addHook('onRequest', (request, reply, done) => {
        reply.header('Access-Control-Allow-Origin', '*');
        done();
    });
    // Serve static UI if available
    const uiPath = join(process.cwd(), 'ui', 'dist');
    try {
        await app.register(import('@fastify/static'), {
            root: uiPath,
            prefix: '/',
        });
    }
    catch (err) {
        console.log('UI not built, skipping static serve');
    }
    const resolveAccount = () => ({ id: 'local-user', label: 'Local Admin' });
    await app.register(claudeAuthRoutes({
        store: claudeAccounts,
        resolveAccount,
        prefix: '/api/claude',
    }));
    await app.register(antigravityAuthRoutes({
        store: antigravityAccounts,
        resolveAccount,
        prefix: '/api/antigravity',
    }));
    // Proxy Endpoint for Cursor
    app.post('/v1/chat/completions', async (request, reply) => {
        const body = request.body;
        if (!body?.model || !body?.messages) {
            return reply.code(400).send({ error: 'Missing model or messages' });
        }
        if (body.stream) {
            return reply.code(400).send({ error: 'Streaming not supported yet' });
        }
        let provider;
        try {
            provider = await resolveProvider(body.model);
        }
        catch (error) {
            return reply.code(400).send({ error: error.message });
        }
        const requestId = generateRequestId();
        let upstreamUrl;
        let upstreamBody;
        if (provider.wire === 'gemini') {
            upstreamUrl = geminiUrl(provider, body.model);
            upstreamBody = JSON.stringify(provider.isSubscription
                ? buildGeminiSubscriptionRequest(body.model, body.messages)
                : buildGeminiKeyRequest(body.model, body.messages));
        }
        else if (provider.wire === 'anthropic') {
            upstreamUrl = anthropicUrl(provider);
            upstreamBody = JSON.stringify(buildAnthropicRequest(body.model, body.messages, body.max_tokens ?? 4096, provider.isSubscription));
        }
        else {
            upstreamUrl = openAiUrl(provider);
            upstreamBody = JSON.stringify({ ...body, stream: false });
        }
        console.log(`Routing ${body.model} via ${provider.source}`);
        const res = await fetch(upstreamUrl, {
            method: 'POST',
            headers: provider.headers,
            body: upstreamBody,
        });
        const parsed = await res.json();
        if (!res.ok) {
            return reply.code(res.status).send(parsed);
        }
        if (provider.wire === 'gemini') {
            return geminiResponseToOpenAi(parsed, body.model, requestId);
        }
        else if (provider.wire === 'anthropic') {
            return anthropicResponseToOpenAi(parsed, body.model, requestId);
        }
        else {
            return openAiResponsePassthrough(parsed, requestId);
        }
    });
    return app;
}
