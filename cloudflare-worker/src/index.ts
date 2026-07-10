/**
 * Cloudflare Worker — Dify 代理（双工作流路由）
 *
 * 作用：
 * 1. 隐藏 DIFY_API_KEY（浏览器无法看到）
 * 2. 统一 CORS 响应头，避免前端跨域被拦截
 * 3. 支持两个工作流：breakdown（智能拆解）/ meeting（会议助手）
 */

interface RequestBody {
  type?: string;
  query?: string;
}

export default {
  async fetch(request: Request, env: {
    DIFY_API_KEY_BREAKDOWN?: string;
    DIFY_API_KEY_MEETING?: string;
    DIFY_BASE_URL?: string;
  }): Promise<Response> {
    const url = new URL(request.url);

    // —— OPTIONS preflight ——
    if (request.method === 'OPTIONS') {
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

    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders(url), 'Content-Type': 'application/json' },
      });
    }

    const type = body.type ?? 'breakdown';
    const query = body.query ?? '';

    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
        status: 400,
        headers: { ...corsHeaders(url), 'Content-Type': 'application/json' },
      });
    }

    // 根据 type 选择 API Key
    const apiKey = type === 'meeting' ? env.DIFY_API_KEY_MEETING : env.DIFY_API_KEY_BREAKDOWN;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: `${type} API Key not configured` }), {
        status: 500,
        headers: { ...corsHeaders(url), 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = env.DIFY_BASE_URL || 'https://api.dify.ai';
    const inputVarName = type === 'meeting' ? 'raw_text' : 'string';

    const targetUrl = new URL(
      baseUrl.endsWith('/v1') ? `${baseUrl}/workflows/run` : `${baseUrl}/v1/workflows/run`,
    );

    try {
      const res = await fetch(targetUrl.toString(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: { [inputVarName]: query },
          response_mode: 'blocking',
          user: 'todo-app-client',
        }),
      });

      const data = await res.json();

      if (data.detail?.error) {
        return new Response(JSON.stringify({ error: data.detail.error }), {
          status: 400,
          headers: { ...corsHeaders(url), 'Content-Type': 'application/json' },
        });
      }
      if (data.code) {
        return new Response(JSON.stringify({ error: `${data.code}: ${data.message}` }), {
          status: res.status,
          headers: { ...corsHeaders(url), 'Content-Type': 'application/json' },
        });
      }

      const content = data.data?.outputs?.out ?? '';
      return new Response(JSON.stringify({ success: true, content }), {
        status: 200,
        headers: { ...corsHeaders(url), 'Content-Type': 'application/json' },
      });
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
    'Access-Control-Max-Age': '86400',
  };
}
