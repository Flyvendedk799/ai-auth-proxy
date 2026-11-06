const fs = require('fs');
let content = fs.readFileSync('server/src/translate.ts', 'utf8');

const regexSub = /export function buildGeminiSubscriptionRequest\([\s\S]*?\): any \{[\s\S]*?const req = toCodeAssistRequest\([\s\S]*?\);/;

const replacementSub = `export function buildGeminiSubscriptionRequest(
  model: string,
  messages: OpenAiMessage[],
  projectId?: string,
  tools?: any[],
  maxTokens?: number,
  temperature?: number,
  topP?: number,
): any {
  const { contents, systemInstruction } = openAiToGeminiContents(messages);
  const req = toCodeAssistRequest(model, contents, {
    projectId: projectId ?? GOOGLE_ENTERPRISE_CLOUD_CODE_PROJECT,
    systemInstruction,
  });

  req.request.generationConfig = {
    ...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
    ...(temperature !== undefined ? { temperature: temperature } : {}),
    ...(topP !== undefined ? { topP: topP } : {}),
  };`;

content = content.replace(regexSub, replacementSub);

const regexKey = /export function buildGeminiKeyRequest\([\s\S]*?\): any \{[\s\S]*?const \{ contents, systemInstruction \} = openAiToGeminiContents\(messages\);/;

const replacementKey = `export function buildGeminiKeyRequest(
  model: string,
  messages: OpenAiMessage[],
  tools?: any[],
  maxTokens?: number,
  temperature?: number,
  topP?: number,
): any {
  const { contents, systemInstruction } = openAiToGeminiContents(messages);`;

content = content.replace(regexKey, replacementKey);

const regexKeyReturn = /return \{\n\s*contents,\n\s*\.\.\.\(systemInstruction[\s\S]*?\},\n\s*\};/;
const replacementKeyReturn = `const req: any = {
    contents,
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
  };
  req.generationConfig = {
    ...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
    ...(temperature !== undefined ? { temperature: temperature } : {}),
    ...(topP !== undefined ? { topP: topP } : {}),
  };
  const geminiTools = openAiToGeminiTools(tools);
  if (geminiTools) {
    req.tools = geminiTools;
  }
  return req;`;
content = content.replace(regexKeyReturn, replacementKeyReturn);

fs.writeFileSync('server/src/translate.ts', content);
