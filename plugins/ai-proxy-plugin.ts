import { readFileSync } from 'fs';
import { join } from 'path';
import type { Plugin } from 'vite';

interface DifyResponse {
	code?: string;
	message?: string;
	detail?: { error?: string };
	data?: { outputs?: Record<string, string>; status?: number };
}

// —— CORS 响应头（开发环境也需跨域支持）——
const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

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
			server.middlewares.use(async (req, res, next) => {
				if (req.method === 'OPTIONS') {
					res.writeHead(204, { ...CORS_HEADERS });
					res.end();
					return;
				}
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
	// 读取请求体（修复冗余 Buffer 包装）
	const bodyChunks: Buffer[] = [];
	for await (const chunk of req) {
		bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	const rawBody = Buffer.concat(bodyChunks);

	let body: { type?: string; query?: string };
	try {
		body = JSON.parse(new TextDecoder('utf-8').decode(rawBody));
	} catch {
		console.error('[AI] ✗ Invalid JSON body');
		res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
		res.end(JSON.stringify({ error: 'Invalid JSON' }));
		return;
	}

	const apiKey = process.env.DIFY_API_KEY_BREAKDOWN || process.env.DIFY_API_KEY || '';
	const apiKeyMeeting = process.env.DIFY_API_KEY_MEETING || '';
	const baseUrl = process.env.DIFY_BASE_URL || 'https://api.dify.ai';

	const type = body.type ?? 'breakdown';
	const query = body.query ?? '';

	console.log(`[AI] → Dify workflow (${type}) query_len=${query.length}`);

	if (!query) {
		console.error('[AI] ✗ Missing query parameter');
		res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
		res.end(JSON.stringify({ error: 'Missing query parameter' }));
		return;
	}

	// 根据 type 选择 API Key
	const effectiveKey = type === 'meeting' ? apiKeyMeeting : apiKey;
	if (!effectiveKey) {
		console.error(`[AI] ✗ ${type} API Key not configured`);
		res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
		res.end(JSON.stringify({ error: `${type} API Key not configured in env` }));
		return;
	}

	// 根据 type 选择输入变量名
	const inputVarName = type === 'meeting' ? 'raw_text' : 'string';

	// Workflow 端点
	const urlStr = baseUrl.endsWith('/v1') ? `${baseUrl}/workflows/run` : `${baseUrl}/v1/workflows/run`;
	console.log(`[AI] url=${urlStr} key=${effectiveKey.slice(0,8)}...`);

	try {
		const dashRes = await fetch(urlStr, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${effectiveKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				inputs: { [inputVarName]: query },
				response_mode: 'blocking',
				user: 'todo-app-client',
			}),
		});

		console.log(`[AI] HTTP status: ${dashRes.status}`);
		const rawText = await dashRes.text();
		console.log(`[AI] raw preview: ${rawText.slice(0, 300)}`);

		let data: DifyResponse;
		try {
			data = JSON.parse(rawText) as DifyResponse;
		} catch {
			console.error('[AI] ✗ Failed to parse Dify response:', rawText.slice(0, 200));
			res.writeHead(502, { 'Content-Type': 'application/json', ...CORS_HEADERS });
			res.end(JSON.stringify({ error: 'Failed to parse Dify response (received unexpected format)' }));
			return;
		}

		if (dashRes.status >= 400) {
			console.error(`[AI] ✗ HTTP ${dashRes.status}: ${JSON.stringify(data).slice(0, 200)}`);
			res.writeHead(dashRes.status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
			res.end(JSON.stringify({ error: `Dify returned ${dashRes.status}` }));
			return;
		}
		if (data.code) {
			console.error(`[AI] ✗ ${data.code}: ${data.message}`);
			res.writeHead(dashRes.status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
			res.end(JSON.stringify({ error: `${data.code}: ${data.message}` }));
			return;
		}

		const content = data.data?.outputs?.out ?? '';
		console.log(`[AI] ✓ ${type} - ${content.length} chars`);
		res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
		res.end(JSON.stringify({ success: true, content }));
	} catch (err: unknown) {
		console.error(`[AI] ✗ fetch failed:`, err instanceof Error ? err.message : String(err));
		if (!res.writableEnded) {
			res.writeHead(502, { 'Content-Type': 'application/json', ...CORS_HEADERS });
			res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Upstream request failed' }));
		}
	}
}
