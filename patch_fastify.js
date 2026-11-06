const fs = require('fs');
const file = 'server/src/server.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace("import Fastify, { FastifyRequest, FastifyReply } from 'fastify';", "import Fastify from 'fastify';\nimport type { FastifyRequest, FastifyReply } from 'fastify';");
fs.writeFileSync(file, content);
