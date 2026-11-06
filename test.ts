import { resolveProvider } from './server/src/resolve.js';
resolveProvider('gemini-3.1-pro').then(console.log).catch(console.error);
