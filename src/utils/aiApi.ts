/**
 * AI 客户端 —— 双模式运行（Dify 平台版）
 * - Tauri 桌面版：通过 Rust IPC 调用内置代理（Key 通过环境变量注入）
 * - Web 版：走 Vite 插件或环境变量指定的代理地址
 */

// —— Tauri 运行时检测 ——
// 通过全局对象 + 用户代理双重确认
const isTauri = typeof (globalThis as any).__TAURI__ !== 'undefined'
  || (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Tauri'));

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AiCallOptions {
  messages: AiMessage[];
}

interface AiResponse {
  success?: boolean;
  content?: string;
  error?: string;
}

// 开发环境本地代理
const PROXY = import.meta.env.VITE_AI_PROXY_URL ?? '/api';

/** 从消息列表中取最后一条 user 角色内容的纯文本作为 Dify query */
function extractQuery(messages: AiMessage[]): string {
  const userMsgs = messages.filter(m => m.role === 'user');
  return userMsgs[userMsgs.length - 1]?.content ?? '';
}

export async function callAi(options: AiCallOptions): Promise<string> {
  const query = extractQuery(options.messages);
  if (!query) {
    throw new Error('未找到有效的用户输入内容');
  }

  // Tauri → 调用后端 Rust 函数，API Key 不暴露给 JS
  if (isTauri) {
    try {
      let invoke: (cmd: string, args: Record<string, any>) => Promise<AiResponse>;
      try {
        const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
        invoke = tauriInvoke;
      } catch {
        throw new Error('Tauri API 加载失败，请确认是在桌面应用中运行');
      }

      const resp: AiResponse = await invoke('call_ai', {
        args: { query },
      });
      if (resp.error) throw new Error(resp.error);
      return resp.content ?? '';
    } catch (err: unknown) {
      throw new Error(`AI 请求失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Web 模式 → HTTP 请求到 Vite 插件或外部代理
  const res = await fetch(`${PROXY}/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    throw new Error(`AI 请求失败 (${res.status})`);
  }

  const data: AiResponse = await res.json();
  if (data.error) throw new Error(data.error);
  return data.content ?? '';
}
