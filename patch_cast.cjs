const fs = require('fs');
let content = fs.readFileSync('server/src/translate.ts', 'utf8');
content = content.replace("req.request.generationConfig =", "(req.request as any).generationConfig =");
fs.writeFileSync('server/src/translate.ts', content);
