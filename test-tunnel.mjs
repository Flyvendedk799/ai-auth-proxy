import { startTunnel } from 'untun';
const t = await startTunnel({ port: 4141 });
console.log('Started');
const url = await t.getURL();
console.log('URL:', url);
await new Promise(r => setTimeout(r, 2000));
await t.close();
console.log('Done');
