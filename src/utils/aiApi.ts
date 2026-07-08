/**
 * AI 代理层——调用 Cloudflare Worker 隐藏 Key。
 * 生产环境的 Proxy URL 通过构建环境变量 VITE_AI_PROXY_URL 注入；
 * 开发环境默认使用 /api（由 Vite 内置插件或 Wrangler 本地 Worker 代理）。
 */

const PROXY = import.meta.env.VITE_AI_PROXY_URL ?? '/api';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCallOptions {
  model?: string;
  messages: AiMessage[];
}

interface AiResponse {
  success?: boolean;
  content?: string;
  error?: string;
}

export async function callAi(options: AiCallOptions): Promise<string> {
  const res = await fetch(`${PROXY}/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model ?? 'qwen-plus',
      messages: options.messages,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI 请求失败 (${res.status})`);
  }

  const data: AiResponse = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.content ?? '';
}
