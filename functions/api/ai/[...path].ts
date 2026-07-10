/**
 * Cloudflare Pages Function — AI Proxy
 *
 * 路径: /api/ai → 转发到 Dify Cloud
 * 自动与前端一起部署，无需额外配置
 */

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const type = body.type ?? 'breakdown';
  const query = body.query ?? '';

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  // 根据 type 选择 API Key 和输入变量名
  const apiKey = type === 'meeting'
    ? process.env.DIFY_API_KEY_MEETING || ''
    : process.env.DIFY_API_KEY_BREAKDOWN || '';

  if (!apiKey) {
    return new Response(JSON.stringify({ error: `${type} API Key not configured` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  const inputVarName = type === 'meeting' ? 'raw_text' : 'string';
  const baseUrl = process.env.DIFY_BASE_URL || 'https://api.dify.ai';
  const targetUrl = baseUrl.endsWith('/v1')
    ? `${baseUrl}/workflows/run`
    : `${baseUrl}/v1/workflows/run`;

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: { [inputVarName]: query },
        response_mode: 'blocking',
        user: 'todo-app-client',
      }),
    });

    const data = await res.json();

    // 错误处理
    if (data.detail?.error) {
      return new Response(JSON.stringify({ error: data.detail.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
    if (data.code) {
      return new Response(
        JSON.stringify({ error: `${data.code}: ${data.message}` }),
        { status: res.status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } },
      );
    }

    const content = data.data?.outputs?.out ?? '';
    return new Response(
      JSON.stringify({ success: true, content }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Upstream request failed' }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders() } },
    );
  }
}

// OPTIONS preflight
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
