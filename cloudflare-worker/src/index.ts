/**
 * Cloudflare Worker — Dify 代理
 *
 * 作用：
 * 1. 隐藏 DIFY_API_KEY（浏览器无法看到）
 * 2. 统一 CORS 响应头，避免前端跨域被拦截
 * 3. 防止 Key 泄露后被滥用——可限制 origin、添加消费监控
 *
 * Key 配置方式（三选一）：
 * - 开发：在 .dev.vars 中写 DIFY_API_KEY=xxx
 * - 部署时传参：wrangler deploy --var DIFY_API_KEY:xxx
 * - Cloudflare 控制台 → Worker → Variables and Secrets
 */

interface RequestBody {
  query?: string;
  conversation_id?: string;
}

export default {
  async fetch(request: Request, env: {
    DIFY_API_KEY: string;
    DIFY_BASE_URL?: string;
  }): Promise<Response> {
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

    const apiKey = env.DIFY_API_KEY;
    const baseUrl = env.DIFY_BASE_URL || 'https://api.dify.ai';

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'DIFY_API_KEY not configured' }), {
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

    const query = body.query ?? '';
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Missing query parameter' }),
        { status: 400, headers: { ...corsHeaders(url), 'Content-Type': 'application/json' } },
      );
    }

    const targetUrl = new URL(
      baseUrl.endsWith('/v1') ? `${baseUrl}/chat-messages` : `${baseUrl}/v1/chat-messages`,
    );

    try {
      const res = await fetch(targetUrl.toString(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          conversation_id: body.conversation_id ?? '',
          inputs: {},
          response_mode: 'blocking',
        }),
      });

      const data = await res.json();

      // 统一错误格式
      if (data.code) {
        return new Response(
          JSON.stringify({ error: `${data.code}: ${data.message}` }),
          { status: res.status, headers: { ...corsHeaders(url), 'Content-Type': 'application/json' } },
        );
      }

      // Dify chat-messages 同步模式返回顶层 answer 字段
      const content = data.answer ?? '';

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
