import { readFileSync } from 'fs';
import { join } from 'path';
import type { Plugin } from 'vite';

// —— 加载 .env / .env.local（开发环境取 AI Key）——
function loadEnvFile(name: string): Record<string, string> {
  const p = join(process.cwd(), name);
  try {
    return readFileSync(p, 'utf-8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .reduce((acc, line) => {
        const [k, ...rest] = line.split('=');
        acc[k.trim()] = rest.join('=').trim();
        return acc;
      }, {} as Record<string, string>);
  } catch {
    return {};
  }
}
const envLocal = loadEnvFile('.env.local');
const envBase   = loadEnvFile('.env');
for (const [k, v] of Object.entries(envLocal)) process.env[k] = v;
for (const [k, v] of Object.entries(envBase))   if (!process.env[k]) process.env[k] = v;

/** 仅在开发服务器（npm run dev）生效 */
export function aiProxyPlugin(): Plugin {
  return {
    name: 'todo-ai-proxy',

    configureServer(server) {
      // 在 Vite 的内部中间件栈中插入我们的处理器
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/') && req.method === 'POST') {
          await handleAiRequest(req, res);
          return;
        }
        next();
      });
    },
  };
}

async function handleAiRequest(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
) {
  const bodyChunks: Buffer[] = [];
  for await (const chunk of req) {
    bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  let body: { query?: string; conversation_id?: string };
  try {
    body = JSON.parse(Buffer.concat(bodyChunks).toString());
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const apiKey = process.env.DIFY_API_KEY;
  const baseUrl = process.env.DIFY_BASE_URL || 'https://api.dify.ai';

  if (!apiKey) {
    console.error('\n⚠️  DIFY_API_KEY 未设置！');
    console.error('   请配置 .env.local 文件中的 DIFY_API_KEY\n');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'DIFY_API_KEY not configured in env' }));
    return;
  }

  try {
    const query = body.query ?? '';
    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing query parameter' }));
      return;
    }

    console.log(`[AI] → Dify (${query.slice(0, 30)}...)`);

    // 解析 baseUrl，支持带 https:// 前缀的情况
    const url = new URL(baseUrl.endsWith('/v1') ? `${baseUrl}/chat-messages` : `${baseUrl}/v1/chat-messages`);

    const dashRes = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        conversation_id: body.conversation_id ?? '',
        inputs: {},
        response_mode: 'blocking',
      }),
    });

    const data = await dashRes.json();

    if (data.code) {
      console.error(`[AI] ✗ ${data.code}: ${data.message}`);
      res.writeHead(dashRes.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `${data.code}: ${data.message}` }));
      return;
    }

    // Dify chat-messages 同步模式返回顶层 answer 字段
    const content = data.answer ?? '';
    console.log(`[AI] ✓ ${content.length} chars`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, content }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AI] ✗ ${msg}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: msg }));
  }
}
