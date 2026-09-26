import { ClaudeTerminal, AntigravityTerminal } from '@flyvendedk799/ai-auth/react';
import '@flyvendedk799/ai-auth/react/terminal.css';
import './App.css';

function App() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>ai-auth proxy</h1>
        <button 
          onClick={async () => {
            if (!confirm('Are you sure you want to disconnect all accounts?')) return;
            try {
              await fetch('/api/logout', { method: 'POST' });
              window.location.reload();
            } catch (err) {
              alert('Failed to logout');
            }
          }}
          style={{ padding: '8px 16px', background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer' }}
        >
          Disconnect All
        </button>
      </div>
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
