import { ClaudeTerminal, AntigravityTerminal } from '@flyvendedk799/ai-auth/react';
import '@flyvendedk799/ai-auth/react/terminal.css';
import './App.css';

function App() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: 8 }}>ai-auth proxy</h1>
      <p style={{ color: '#666', marginBottom: 40 }}>
        Connect your subscriptions below. The local proxy will route your Cursor AI requests through these accounts.
        <br/><br/>
        <strong>Cursor Setup:</strong><br/>
        Settings &gt; Models &gt; OpenAI API Key (enter any dummy text)<br/>
        Override OpenAI Base URL: <code>http://localhost:4141/v1</code>
      </p>

      <div style={{ display: 'grid', gap: 32 }}>
        <section>
          <h2>Antigravity (Google / Gemini)</h2>
          <AntigravityTerminal />
        </section>

        <section>
          <h2>Claude Code (Anthropic)</h2>
          <ClaudeTerminal />
        </section>
      </div>
    </div>
  );
}

export default App;
