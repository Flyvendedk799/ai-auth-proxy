import { createServer } from './server.js';
import open from 'open'; // We'll need to install this

async function start() {
  const app = await createServer();
  const port = Number(process.env.PORT || 4141);
  const host = '127.0.0.1';

  try {
    await app.listen({ port, host });
    console.log(`\n  ai-auth-proxy  ·  Server running at http://${host}:${port}`);
    console.log(`  Set Cursor's OpenAI Base URL to: http://${host}:${port}/v1`);
    
    // Open the UI
    console.log(`  Opening UI...`);
    await open(`http://${host}:${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
