/**
 * Cloudflare Pages Function — AI Proxy (Dify)
 *
 * 作用:
 * - 拦截 /api/ai POST 请求，转发到 Dify Cloud Workflow
 * - 隐藏 API Key（浏览器无法看到）
 * - 统一 CORS 响应头
 * - 同时支持两个工作流: breakdown（智能拆解）/ meeting（会议助手）
 *
 * 部署: 与前端一起自动部署到 Cloudflare Pages
 * 环境变量: 在 Pages 设置 → Environment Variables 中配置
 */

interface RequestBody {
	type?: string;
	query?: string;
}

// 从环境读取配置
const env = {
	DIFY_API_KEY_BREAKDOWN: process.env.DIFY_API_KEY_BREAKDOWN || '',
	DIFY_API_KEY_MEETING: process.env.DIFY_API_KEY_MEETING || '',
	DIFY_BASE_URL: process.env.DIFY_BASE_URL || 'https://api.dify.ai',
};

export async function onRequestPost({ request, env }: any) {
	const url = new URL(request.url);

	// 解析请求体
	let body: RequestBody;
	try {
		body = await request.json();
	} catch {
		return jsonResponse({ error: 'Invalid JSON' }, 400, url);
	}

	const type = body.type ?? 'breakdown';
	const query = body.query ?? '';

	if (!query) {
		return jsonResponse({ error: 'Missing query parameter' }, 400, url);
	}

	// 根据 type 选择 API Key 和输入变量名
	const apiKey = type === 'meeting' ? env.DIFY_API_KEY_MEETING : env.DIFY_API_KEY_BREAKDOWN;
	if (!apiKey) {
		return jsonResponse({ error: `${type} API Key not configured` }, 500, url);
	}

	const inputVarName = type === 'meeting' ? 'raw_text' : 'string';
	const baseUrl = env.DIFY_BASE_URL || 'https://api.dify.ai';
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

		// Dify 错误处理
		if (data.detail?.error) {
			return jsonResponse({ error: data.detail.error }, 400, url);
		}
		if (data.code) {
			return jsonResponse(
				{ error: `${data.code}: ${data.message}` },
				res.status,
				url,
			);
		}

		const content = data.data?.outputs?.out ?? '';
		return jsonResponse({ success: true, content }, 200, url);
	} catch (err: unknown) {
		return jsonResponse(
			{ error: err instanceof Error ? err.message : 'Upstream request failed' },
			502,
			url,
		);
	}
}

// OPTIONS preflight for CORS
export async function onRequestOptions({ request }: any) {
	const url = new URL(request.url);
	return new Response(null, {
		status: 204,
		headers: corsHeaders(url),
	});
}

function jsonResponse(data: Record<string, unknown>, status: number, url: URL): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json', ...corsHeaders(url) },
	});
}

function corsHeaders(origin: URL): Record<string, string> {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Max-Age': '86400',
	};
}
