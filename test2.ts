import { AntigravityCliCredential } from '@flyvendedk799/ai-auth';
const cli = new AntigravityCliCredential();
cli.identity().then(console.log).catch(console.error);
