import type { Plugin } from 'vite';

interface DashScopeResponse {
  output?: { choices?: Array<{ message: { content: string } }> };
  code?: string;
  message?: string;
}

/**
 * Vite 插件：开发时将 /api/ai POST 请求直接代理到 DashScope。
 * 生产环境不生效（apply: 'serve'），由部署的 Cloudflare Worker 处理。
 *
 * 好处：无需单独开终端跑 Wrangler，一个 npm run dev 搞定全部。
 */
export function aiProxyPlugin(): Plugin {
  return {
    name: 'todo-ai-proxy',

    /** 仅在开发服务器（npm run dev）生效 */
    apply: 'serve',

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

  let body: { model?: string; messages?: Array<{ role: string; content: string }> };
  try {
    body = JSON.parse(Buffer.concat(bodyChunks).toString());
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.error('\n⚠️  DASHSCOPE_API_KEY 未设置！');
    console.error('   请运行以下命令后再试：');
    console.error('   Windows PowerShell: $env:DASHSCOPE_API_KEY="sk-your-key"');
    console.error('   Git Bash:           export DASHSCOPE_API_KEY="sk-your-key"\n');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'DASHSCOPE_API_KEY not configured in env' }));
    return;
  }

  try {
    console.log(`[AI] → ${body.model ?? 'qwen-plus'} (${body.messages?.length ?? 0} messages)`);

    const dashRes = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'disable',
        },
        body: JSON.stringify({
          model: body.model ?? 'qwen-plus',
          input: { messages: body.messages ?? [] },
          parameters: { incremental_output: false },
        }),
      },
    );

    const data = await dashRes.json() as DashScopeResponse;

    if (data.code) {
      console.error(`[AI] ✗ ${data.code}: ${data.message}`);
      res.writeHead(dashRes.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `${data.code}: ${data.message}` }));
      return;
    }

    const content = data.output?.choices?.[0]?.message?.content ?? '';
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
