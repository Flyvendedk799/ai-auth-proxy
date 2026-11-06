const fs = require('fs');
let content = fs.readFileSync('server/src/translate.ts', 'utf8');

const regex = /export function buildGeminiKeyRequest\([\s\S]*?\}\n\ninterface GeminiResponse/g;

const replacement = `export function buildGeminiKeyRequest(
  model: string,
  messages: OpenAiMessage[],
  tools?: any[],
  maxTokens?: number,
  temperature?: number,
  topP?: number,
): any {
  const { contents, systemInstruction } = openAiToGeminiContents(messages);
  const geminiTools = openAiToGeminiTools(tools);
  
  return {
    contents,
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
    ...(geminiTools ? { tools: geminiTools } : {}),
    generationConfig: {
      ...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
      ...(temperature !== undefined ? { temperature: temperature } : {}),
      ...(topP !== undefined ? { topP: topP } : {}),
    }
  };
}

interface GeminiResponse`;

content = content.replace(regex, replacement);
fs.writeFileSync('server/src/translate.ts', content);
