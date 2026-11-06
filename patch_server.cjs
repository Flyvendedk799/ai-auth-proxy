const fs = require('fs');
let content = fs.readFileSync('server/src/server.ts', 'utf8');

content = content.replace(
  "buildGeminiSubscriptionRequest(actualModelName, body.messages, undefined, body.tools)",
  "buildGeminiSubscriptionRequest(actualModelName, body.messages, undefined, body.tools, body.max_tokens, body.temperature, body.top_p)"
);

content = content.replace(
  "buildGeminiKeyRequest(actualModelName, body.messages, body.tools)",
  "buildGeminiKeyRequest(actualModelName, body.messages, body.tools, body.max_tokens, body.temperature, body.top_p)"
);

fs.writeFileSync('server/src/server.ts', content);
