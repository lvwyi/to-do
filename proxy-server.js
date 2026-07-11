/**
 * AI 反向代理 —— Dify Cloud 平台版（Node.js）
 *
 * 用途：在 Docker 容器内与 Nginx 并行运行，监听端口 3000
 * 支持两个工作流路由：breakdown（智能拆解）/ meeting（会议助手）
 */
const http = require('node:http');
const https = require('node:https');
const { createServer } = require('node:http');
const { parse } = require('node:url');

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

    const apiRes = await new Promise((resolve, reject) => {
      const options = {
        hostname: targetUrl.hostname,
        path: targetUrl.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };
      if (targetUrl.port) options.port = parseInt(targetUrl.port, 10);
      const proxyReq = client.request(options, resolve);
      proxyReq.on('error', reject);
      proxyReq.write(payload);
      proxyReq.end();
    }).catch(err => {
      console.error('[Proxy] Dify fetch failed:', err.message);
      throw new Error(`Dify API unreachable: ${err.message}`);
    });

    const respChunks = [];
    for await (const chunk of apiRes) {
      respChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    let respData;
    try {
      respData = JSON.parse(Buffer.concat(respChunks).toString());
    } catch {
      console.error('[Proxy] Invalid JSON from Dify:', Buffer.concat(respChunks).toString().slice(0, 200));
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ error: 'Invalid response from Dify API' }));
      return;
    }

    if (respData.code) {
      res.writeHead(apiRes.statusCode || 400, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ error: `${respData.code}: ${respData.message}` }));
      return;
    }

    const content = respData.data?.outputs?.out ?? '';

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ success: true, content }));
  } catch (err) {
    console.error('[Proxy Error]', err.message);
    res.writeHead(502, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`✅ AI Proxy (Dify) running on http://localhost:${PORT}`);
});
