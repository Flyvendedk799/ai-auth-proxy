import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { claudeAuthRoutes, antigravityAuthRoutes } from '@flyvendedk799/ai-auth/fastify';
import { resolveProvider } from './resolve.js';
import {
  buildGeminiSubscriptionRequest,
  buildGeminiKeyRequest,
  buildAnthropicRequest,
  geminiResponseToOpenAi,
  anthropicResponseToOpenAi,
  openAiResponsePassthrough,
  geminiUrl,
  anthropicUrl,
  openAiUrl,
  generateRequestId,
  type OpenAiRequest,
} from './translate.js';
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
  } catch (err) {
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

  app.post('/api/logout', async (request, reply) => {
    try {
      await claudeAccounts.forget('local-user');
      await antigravityAccounts.forget('local-user');
      return reply.send({ success: true });
    } catch (e) {
      return reply.code(500).send({ error: (e as Error).message });
    }
  });

  app.get('/v1/models', async (request, reply) => {
    const available: Array<{ id: string; owned_by: string }> = [];

    const tryModels = async (models: string[], wire: string) => {
      try {
        await resolveProvider(models[0]);
        for (const m of models) {
          available.push({ id: m, owned_by: wire });
        }
      } catch {
        // Not available
      }
    };

    await Promise.all([
      tryModels([
        'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash', 'gemini-3-pro', 'gemini-3.1-pro',
        'proxy-gemini-2.5-flash', 'proxy-gemini-2.5-pro', 'proxy-gemini-3-flash', 'proxy-gemini-3-pro', 'proxy-gemini-3.1-pro'
      ], 'gemini'),
      tryModels([
        'claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-5',
        'proxy-claude-haiku-4-5-20251001', 'proxy-claude-sonnet-5', 'proxy-claude-opus-5'
      ], 'anthropic'),
      tryModels([
        'gpt-5-mini', 'gpt-5', 'gpt-4.1', 'o4-mini',
        'proxy-gpt-5-mini', 'proxy-gpt-5', 'proxy-gpt-4.1', 'proxy-o4-mini'
      ], 'openai'),
    ]);

    return reply.send({
      object: 'list',
      data: available.map((m) => ({
        id: m.id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: m.owned_by,
      })),
    });
  });

  // Proxy Endpoint for Cursor
  app.post('/v1/chat/completions', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as OpenAiRequest;
    
    if (!body?.model || !body?.messages) {
      return reply.code(400).send({ error: 'Missing model or messages' });
    }

    // Strip 'proxy-' prefix if the user had to add it to bypass Cursor's name collision check
    const actualModelName = body.model.startsWith('proxy-') ? body.model.slice(6) : body.model;

    let provider;
    try {
      provider = await resolveProvider(actualModelName);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }

    const requestId = generateRequestId();
    let upstreamUrl: string;
    let upstreamBody: string;

    if (provider.wire === 'gemini') {
      upstreamUrl = geminiUrl(provider, actualModelName);
      upstreamBody = JSON.stringify(provider.isSubscription 
        ? buildGeminiSubscriptionRequest(actualModelName, body.messages, undefined, body.tools)
        : buildGeminiKeyRequest(actualModelName, body.messages, body.tools)
      );
    } else if (provider.wire === 'anthropic') {
      upstreamUrl = anthropicUrl(provider);
      upstreamBody = JSON.stringify(buildAnthropicRequest(actualModelName, body.messages, body.max_tokens ?? 4096, provider.isSubscription));
    } else {
      upstreamUrl = openAiUrl(provider);
      upstreamBody = JSON.stringify({ ...body, model: actualModelName, stream: false });
    }

    console.log(`Routing ${actualModelName} via ${provider.source}`);
    console.log('Sending body:', upstreamBody);

    const res = await fetch(upstreamUrl, {
      method: 'POST',
      headers: provider.headers,
      body: upstreamBody,
    });

    const parsed = await res.json() as any;

    if (!res.ok || parsed.error) {
      console.error(`Upstream returned error (status ${res.status}):`, JSON.stringify(parsed, null, 2));
      const status = res.ok ? 500 : res.status;
      return reply.code(status).send(parsed);
    }
    
    console.log('Upstream returned SUCCESS:', JSON.stringify(parsed, null, 2));

    let formattedResponse;
    if (provider.wire === 'gemini') {
      formattedResponse = geminiResponseToOpenAi(parsed, actualModelName, requestId);
    } else if (provider.wire === 'anthropic') {
      formattedResponse = anthropicResponseToOpenAi(parsed, actualModelName, requestId);
    } else {
      formattedResponse = openAiResponsePassthrough(parsed, requestId);
    }

    console.log('Returning to Cursor:', JSON.stringify(formattedResponse, null, 2));

    if (body.stream) {
      const chunk = {
        id: requestId,
        object: 'chat.completion.chunk',
        created: formattedResponse.created,
        model: formattedResponse.model,
        choices: [{
          index: 0,
          delta: {
            role: 'assistant',
            content: formattedResponse.choices[0]?.message.content ?? '',
            ...(formattedResponse.choices[0]?.message.tool_calls ? { tool_calls: formattedResponse.choices[0]?.message.tool_calls } : {})
          },
          finish_reason: null
        }]
      };

      const finalChunk = {
        id: requestId,
        object: 'chat.completion.chunk',
        created: formattedResponse.created,
        model: formattedResponse.model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: formattedResponse.choices[0]?.finish_reason ?? 'stop'
        }]
      };

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      reply.raw.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
      
      // Tell fastify we handled the response natively
      reply.hijack();
      return;
    }

    return formattedResponse;
  });

  return app;
}
