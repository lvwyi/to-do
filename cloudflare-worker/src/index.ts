/**
 * Cloudflare Worker — DashScope 代理
 *
 * 作用：
 * 1. 隐藏 DASHSCOPE_API_KEY（浏览器无法看到）
 * 2. 统一 CORS 响应头，避免前端跨域被拦截
 * 3. 防止 Key 泄露后被滥用——可限制 origin、添加消费监控
 *
 * Key 配置方式（三选一）：
 * - 开发：在 .dev.vars 中写 DASHSCOPE_API_KEY=sk-xxx
 * - 部署时传参：wrangler deploy --var DASHSCOPE_API_KEY:sk-xxx
 * - Cloudflare 控制台 → Worker → Variables and Secrets
 */

interface RequestBody {
  model?: string;
  input?: Record<string, unknown>;
  messages?: Array<{ role: string; content: string }>;
}

interface ChatChoice {
  message: { role: string; content: string };
}

interface ApiResponse {
  output?: { choices?: ChatChoice[]; text?: string };
  code?: string;
  message?: string;
}

export default {
  async fetch(request: Request, env: { DASHSCOPE_API_KEY: string }): Promise<Response> {
    const url = new URL(request.url);
    console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);

    // —— OPTIONS preflight ——
    if (request.method === 'OPTIONS') {
      console.log('[preflight] allowing request');
      return new Response(null, { status: 204, headers: corsHeaders(url) });
    }

    // —— 只允许 POST /api/ai* 路径 ——
    if (url.pathname !== '/api/ai' && !url.pathname.startsWith('/api/ai?')) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders(url), 'Content-Type': 'application/json' },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders(url), 'Content-Type': 'application/json' },
      });
    }

    const apiKey = env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'DASHSCOPE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders(url), 'Content-Type': 'application/json' },
      });
    }

    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders(url), 'Content-Type': 'application/json' },
      });
    }

    const { model = 'qwen-plus', messages } = body;

    try {
      const res = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'disable',
        },
        body: JSON.stringify({
          model,
          input: { messages },
          parameters: { incremental_output: false },
        }),
      });

      const data: ApiResponse = await res.json() as ApiResponse;

      // 统一错误格式
      if (data.code) {
        return new Response(
          JSON.stringify({ error: `${data.code}: ${data.message}` }),
          { status: res.status, headers: { ...corsHeaders(url), 'Content-Type': 'application/json' } },
        );
      }

      // 兼容新旧格式：新版本返回 output.text，旧版输出 output.choices[0].message.content
      const content = data.output?.text ?? data.output?.choices?.[0]?.message?.content ?? '';

      return new Response(
        JSON.stringify({ success: true, content }),
        { status: 200, headers: { ...corsHeaders(url), 'Content-Type': 'application/json' } },
      );
    } catch (err: unknown) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Upstream request failed' }),
        { status: 502, headers: { ...corsHeaders(url), 'Content-Type': 'application/json' } },
      );
    }
  },
} satisfies ExportedHandler;

function corsHeaders(origin: URL): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    // 缓存预检请求结果，减少 preflight 频率
    'Access-Control-Max-Age': '86400',
  };
}
