import { createServer } from './server.js';
import open from 'open';
import { startTunnel } from 'untun';

async function start() {
  const port = Number(process.env.PORT || 4141);
  const host = '127.0.0.1';
  let tunnelUrl = undefined;
  
  if (process.argv.includes('--tunnel')) {
    console.log('Starting Cloudflare tunnel...');
    const t = await startTunnel({ port });
    tunnelUrl = await t?.getURL();
  }

  const app = await createServer({ tunnelUrl });

  try {
    await app.listen({ port, host });
    console.log('\n  ai-auth-proxy  ·  Server running at http://' + host + ':' + port);
    if (tunnelUrl) {
      console.log('  Tunnel URL: ' + tunnelUrl);
      console.log('  Set Cursor\'s OpenAI Base URL to: ' + tunnelUrl + '/v1');
    } else {
      console.log('  Set Cursor\'s OpenAI Base URL to: http://' + host + ':' + port + '/v1');
    }
    
    // Open the UI
    console.log('  Opening UI...');
    await open('http://' + host + ':' + port);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();

