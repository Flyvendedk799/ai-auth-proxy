import { AntigravityCliCredential, antigravityCliOptions } from './node_modules/@flyvendedk799/ai-auth/dist/index.js';
import fetch from 'node-fetch'; // wait, node 18 has fetch

async function run() {
  const cli = new AntigravityCliCredential();
  const identity = await cli.identity().catch(() => null);
  if (!identity) {
    console.log("No CLI identity");
    return;
  }
  const opts = antigravityCliOptions(identity);
  console.log("Got token");
  
  const body = {
    model: 'gemini-3.1-pro-low',
    request: {
      contents: [{ role: 'user', parts: [{ text: 'Write a haiku about code.' }] }]
    }
  };
  
  const res = await globalThis.fetch('https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse', {
    method: 'POST',
    headers: opts.defaultHeaders,
    body: JSON.stringify(body)
  });
  
  console.log(res.status, res.statusText);
  const text = await res.text();
  console.log(text.slice(0, 500));
}
run();
