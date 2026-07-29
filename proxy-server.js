/**
 * AI 反向代理 —— Dify Cloud 平台版（Node.js）
 *
 * 用途：在 Docker 容器内与 Nginx 并行运行，监听端口 3000
 * 支持两个工作流路由：breakdown（智能拆解）/ meeting（会议助手）
 */
const http = require('node:http');
const https = require('node:https');
const { createServer } = require('node:http');

// —— 从环境变量或 .env / .env.local 文件加载配置 ——
const DOTENV_PATHS = [require('path').join(__dirname, '.env.local'), require('path').join(__dirname, '.env')];
let apiKeyBreakdown = '';
let apiKeyMeeting = '';
let baseUrl = 'https://api.dify.ai';

try {
  const fs = require('fs');
  // 优先读取 .env.local（包含 API Key），再读 .env（可能只含基础配置）
  for (const dotenvPath of DOTENV_PATHS) {
    try {
      const raw = fs.readFileSync(dotenvPath, 'utf-8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...rest] = trimmed.split('=');
        const value = rest.join('=').trim();
        if (key.trim() === 'DIFY_API_KEY_BREAKDOWN') apiKeyBreakdown = value;
        if (key.trim() === 'DIFY_API_KEY_MEETING') apiKeyMeeting = value;
        if (key.trim() === 'DIFY_BASE_URL') baseUrl = value;
      }
    } catch {} // 文件不存在则跳过
  }
} catch {}

apiKeyBreakdown = process.env.DIFY_API_KEY_BREAKDOWN || apiKeyBreakdown;
apiKeyMeeting   = process.env.DIFY_API_KEY_MEETING || apiKeyMeeting;
baseUrl         = process.env.DIFY_BASE_URL || baseUrl;

if (!apiKeyBreakdown && !apiKeyMeeting) {
  console.error('⚠️  DIFY_API_KEY_BREAKDOWN 和 DIFY_API_KEY_MEETING 至少需要一个！');
  process.exit(1);
}

const PORT = parseInt(process.env.PROXY_PORT || '3000', 10);
const TIMEOUT_MS = 60_000;    // Dify 工作流超时
const MAX_RETRIES = 1;        // 最多重试 1 次
const RETRY_DELAY_MS = 2_000; // 重试间隔 2s

// —— 辅助：检测 HTML 响应 ——
function isHtmlResponse(text) {
  const lower = text.toLowerCase();
  return lower.includes('<!doctype html>') || lower.includes('<html');
}

// —— 辅助：发送 JSON 响应 ——
function sendJson(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (!req.url?.startsWith('/api') || req.method !== 'POST') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString());

    const type = body.type ?? 'breakdown';
    const query = body.query ?? '';
    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing query parameter' }));
      return;
    }

    // 根据 type 选择 API Key
    const apiKey = type === 'meeting' ? apiKeyMeeting : apiKeyBreakdown;
    if (!apiKey) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `${type} API Key not configured` }));
      return;
    }

    // 根据 type 选择输入变量名
    const inputVarName = type === 'meeting' ? 'raw_text' : 'string';

    const targetUrl = new URL(
      baseUrl.endsWith('/v1') ? `${baseUrl}/workflows/run` : `${baseUrl}/v1/workflows/run`,
    );
    const isHttps = targetUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = JSON.stringify({
      inputs: { [inputVarName]: query },
      response_mode: 'blocking',
      user: 'todo-app-client',
    });

    console.log(`[Proxy] → Dify (${type}) url=${targetUrl.pathname}`);

    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        console.log(`[Proxy] ↻ 重试 (${attempt}/${MAX_RETRIES})...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }

      const apiRes = await new Promise((resolve, reject) => {
        const options = {
          hostname: targetUrl.hostname,
          path: targetUrl.pathname,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'Connection': 'keep-alive',
          },
        };
        if (targetUrl.port) options.port = parseInt(targetUrl.port, 10);
        let timeoutId;
        const proxyReq = client.request(options, res => {
          clearTimeout(timeoutId);
          resolve(res);
        });
        timeoutId = setTimeout(() => {
          proxyReq.destroy(new Error(`Timeout after ${TIMEOUT_MS}ms`));
        }, TIMEOUT_MS);
        proxyReq.on('error', err => {
          clearTimeout(timeoutId);
          reject(err);
        });
        proxyReq.write(payload);
        proxyReq.end();
      }).catch(err => {
        lastError = err;
        console.error('[Proxy] ✗ fetch failed:', err.message);
        return null;
      });

      if (!apiRes) {
        if (attempt < MAX_RETRIES) continue;
        break;
      }

      const respChunks = [];
      for await (const chunk of apiRes) {
        respChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      let rawText;
      try {
        rawText = Buffer.concat(respChunks).toString();
      } catch {
        console.error('[Proxy] Failed to read response');
        sendJson(res, 502, { error: 'Failed to read response from Dify' });
        return;
      }

      console.log(`[Proxy] HTTP status: ${apiRes.statusCode}`);
      console.log(`[Proxy] raw preview: ${rawText.slice(0, 300)}`);

      // 检测 Cloudflare / WAF / CDN 返回的 HTML 拦截页面
      if (isHtmlResponse(rawText)) {
        const statusCode = apiRes.statusCode || 502;
        console.error(`[Proxy] ✗ Received HTML instead of JSON (status=${statusCode})`);
        lastError = new Error(`Received HTML instead of JSON (status=${statusCode})`);
        if (attempt < MAX_RETRIES) continue; // 触发重试
        sendJson(res, statusCode === 504 ? 504 : 502, {
          error: statusCode === 504
            ? 'Dify 处理超时（504）。大段会议文稿可能需要较长时间，请再试一次。'
            : '收到非 JSON 响应（可能是 CDN/WAF 拦截），请稍后重试。',
        });
        return;
      }

      let respData;
      try {
        respData = JSON.parse(rawText);
      } catch {
        console.error('[Proxy] Invalid JSON:', rawText.slice(0, 200));
        sendJson(res, 502, { error: 'Invalid response from Dify API' });
        return;
      }

      if (respData.code) {
        sendJson(res, apiRes.statusCode || 400, {
          error: `${respData.code}: ${respData.message}`,
        });
        return;
      }

      const content = respData.data?.outputs?.out ?? '';
      sendJson(res, 200, { success: true, content });
      return; // 成功即退出
    }

    // 所有重试耗尽
    sendJson(res, 504, {
      error: lastError instanceof Error ? lastError.message : 'Request failed after retries',
    });
  } catch (err) {
    console.error('[Proxy Error]', err.message);
    sendJson(res, 502, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`✅ AI Proxy (Dify) running on http://localhost:${PORT}`);
});
