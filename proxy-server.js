/**
 * AI 反向代理 —— Dify 平台版（Node.js）
 *
 * 用途：在国内服务器上运行，供 Nginx 反向代理转发 AI 请求
 * 不暴露 API Key，支持 CORS
 */
const http = require('node:http');
const https = require('node:https');
const { createServer } = require('node:http');
const { parse } = require('node:url');

// —— 从环境变量或 .env 文件加载配置 ——
const DOTENV_PATH = require('path').join(__dirname, '.env');
let apiKey = '';
let baseUrl = 'https://api.dify.ai';
try {
  const fs = require('fs');
  const raw = fs.readFileSync(DOTENV_PATH, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim();
    if (key.trim() === 'DIFY_API_KEY') {
      apiKey = value;
    }
    if (key.trim() === 'DIFY_BASE_URL') {
      baseUrl = value;
    }
  }
} catch {}

apiKey = process.env.DIFY_API_KEY || apiKey;
baseUrl = process.env.DIFY_BASE_URL || baseUrl;

if (!apiKey) {
  console.error('⚠️  DIFY_API_KEY 未设置！');
  console.error('   请配置 .env 文件或设置环境变量 DIFY_API_KEY');
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

    const query = body.query ?? '';
    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing query parameter' }));
      return;
    }

    const targetUrl = new URL(baseUrl.endsWith('/v1') ? `${baseUrl}/chat-messages` : `${baseUrl}/v1/chat-messages`);
    const isHttps = targetUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = JSON.stringify({
      query,
      conversation_id: body.conversation_id ?? '',
      inputs: {},
      response_mode: 'blocking',
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
    });

    // 读取响应
    const respChunks = [];
    for await (const chunk of apiRes) {
      respChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const respData = JSON.parse(Buffer.concat(respChunks).toString());

    // Dify chat-messages 同步模式返回顶层 answer 字段
    const content = respData.answer ?? '';

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
