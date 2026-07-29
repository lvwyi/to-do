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

// —— CORS 响应头 ——
const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Access-Control-Max-Age': '86400',
};

const TIMEOUT_MS = 60_000;      // Dify 工作流超时（原 30s 对长输入不够）
const MAX_RETRIES = 1;          // 最多重试 1 次（应对偶发网关超时）
const RETRY_DELAY_MS = 2_000;   // 重试间隔 2s

// —— 检测 HTML 响应（Cloudflare / WAF / CDN 拦截页面）——
function isHtmlResponse(text: string): boolean {
	const lower = text.toLowerCase();
	return lower.includes('<!doctype html>') || lower.includes('<html');
}

export async function onRequestPost({ request, env }: { request: Request; env: { DIFY_API_KEY_BREAKDOWN?: string; DIFY_API_KEY_MEETING?: string; DIFY_BASE_URL?: string } }) {
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
	const apiKey = type === 'meeting' ? (env as any)?.DIFY_API_KEY_MEETING : (env as any)?.DIFY_API_KEY_BREAKDOWN;
	if (!apiKey) {
		return jsonResponse({ error: `${type} API Key not configured` }, 500, url);
	}

	const inputVarName = type === 'meeting' ? 'raw_text' : 'string';
	const baseUrl = (env as any)?.DIFY_BASE_URL || 'https://api.dify.ai';
	const targetUrl = baseUrl.endsWith('/v1')
		? `${baseUrl}/workflows/run`
		: `${baseUrl}/v1/workflows/run`;

	console.log(`[AI] → Dify workflow (${type}) target=${targetUrl}`);

	try {
		let lastError: unknown | undefined;

		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			lastError = undefined;

			if (attempt > 0) {
				console.log(`[AI] ↻ 重试 (${attempt}/${MAX_RETRIES})...`);
				await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
			}

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

			let res: Response;
			try {
				res = await fetch(targetUrl, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${apiKey}`,
						'Content-Type': 'application/json',
						'Accept': 'application/json',
					},
					body: JSON.stringify({
						inputs: { [inputVarName]: query },
						response_mode: 'blocking',
						user: 'todo-app-client',
					}),
					signal: controller.signal,
				});
			} catch (fetchErr) {
				clearTimeout(timeoutId);
				if ((fetchErr as Error).name === 'AbortError') {
					lastError = new Error('Dify 处理超时，请稍后重试');
					if (attempt < MAX_RETRIES) continue;
					break;
				}
				throw fetchErr;
			}
			clearTimeout(timeoutId);

			const rawText = await res.text();
			console.log(`[AI] HTTP status: ${res.status}`);
			console.log(`[AI] raw preview: ${rawText.slice(0, 300)}`);

			// 检测 Cloudflare / WAF / CDN 返回的 HTML 拦截页面
			if (isHtmlResponse(rawText)) {
				const statusCode = res.status;
				console.error(`[AI] ✗ Received HTML instead of JSON (status=${statusCode})`);

				if (attempt < MAX_RETRIES) continue; // 触发重试

				return jsonResponse({
					error: statusCode === 504
						? 'Dify 处理超时（504）。大段会议文稿可能需要较长时间，请再试一次。'
						: '收到非 JSON 响应（可能是 CDN/WAF 拦截），请稍后重试。',
				}, statusCode === 504 ? 504 : 502, url);
			}

			let data;
			try {
				data = JSON.parse(rawText);
			} catch {
				console.error('[AI] ✗ Failed to parse response:', rawText.slice(0, 200));
				return jsonResponse({ error: 'Failed to parse Dify response' }, 502, url);
			}

			// Dify 错误处理
			if (data.detail?.error) {
				return jsonResponse({ error: data.detail.error }, 400, url);
			}
			if (data.code) {
				console.error(`[AI] ✗ ${data.code}: ${data.message}`);
				return jsonResponse(
					{ error: `${data.code}: ${data.message}` },
					res.status,
					url,
				);
			}

			const content = data.data?.outputs?.out ?? '';
			console.log(`[AI] ✓ ${type} - ${content.length} chars`);
			return jsonResponse({ success: true, content }, 200, url);
		}

		// 所有重试耗尽
		return jsonResponse(
			{ error: lastError instanceof Error ? lastError.message : 'Request failed after retries' },
			504,
			url,
		);
	} catch (err: unknown) {
		console.error(`[AI] ✗ upstream failed:`, err instanceof Error ? err.message : String(err));
		return jsonResponse(
			{ error: err instanceof Error ? err.message : 'Upstream request failed' },
			502,
			url,
		);
	}
}

// OPTIONS preflight for CORS
export async function onRequestOptions({ request }: any) {
	const _url = new URL(request.url);
	return new Response(null, {
		status: 204,
		headers: { ...CORS },
	});
}

function jsonResponse(data: Record<string, unknown>, status: number, _url: URL): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json', ...CORS },
	});
}
