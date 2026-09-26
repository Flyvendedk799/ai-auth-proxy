import {
  JsonFileCredentialStore,
  ClaudeAccountStore,
  AntigravityAccountStore
} from '@flyvendedk799/ai-auth';
import { join } from 'node:path';
import { homedir } from 'node:os';

const dbPath = join(homedir(), '.ai-auth-proxy', 'credentials.json');

export const aiAuthStore = new JsonFileCredentialStore({
  path: dbPath,
});

// A dummy secret for the local proxy since it's only securing data on the user's own machine.
const dummySecret = 'local-proxy-static-secret-not-for-prod-servers';

export const claudeAccounts = new ClaudeAccountStore({
  store: aiAuthStore,
  secret: dummySecret,
  secretLabel: 'ai-auth-proxy-local',
});

export const antigravityAccounts = new AntigravityAccountStore({
  store: aiAuthStore,
  secret: dummySecret,
});
