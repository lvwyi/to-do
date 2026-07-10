/**
 * AI 客户端 —— Dify Cloud 平台版
 * - Web 模式：通过本地代理转发请求，避免 API Key 暴露给浏览器
 * - Tauri 模式：暂未支持（双 Key 场景复杂度高）
 */

const PROXY = import.meta.env.VITE_AI_PROXY_URL ?? '/api';

/** 会议分析返回结果类型 */
export interface MeetingResult {
  info: { title: string; time: string; participants: string[] };
  topics: string[];
  decisions: { id: string; content: string }[];
  tasks: { id: string; content: string; assignee: string; due: string }[];
  speeches: { id: string; speaker: string; content: string }[];
  cleanedText: string;
}

/** SubTask 接口 — 智能拆解返回的子任务格式 */
interface SubTask {
  text: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
}

/** Dify Workflow 响应格式 */
interface DifyWorkflowResponse {
  code?: string;
  message?: string;
  detail?: { error?: string };
  data?: { outputs?: Record<string, string>; status?: number };
}

/** 从消息列表中取最后一条 user 角色内容的纯文本作为 Dify query */
function extractQuery(messages: { role: string; content: string }[]): string {
  const userMsgs = messages.filter(m => m.role === 'user');
  return userMsgs[userMsgs.length - 1]?.content ?? '';
}

// ---- 共享 fetch 逻辑 ----

async function callDify(type: 'breakdown' | 'meeting', query: string): Promise<string> {
  const res = await fetch(`${PROXY}/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, query }),
  });

  if (!res.ok) {
    throw new Error(`AI 请求失败 (${res.status})`);
  }

  const data: DifyWorkflowResponse = await res.json();
  if (data.code) throw new Error(`${data.code}: ${data.message}`);
  if (data.detail?.error) throw new Error(data.detail.error);

  const content = data.data?.outputs?.out ?? '';
  if (!content.trim()) throw new Error('AI 未返回有效内容');

  return content;
}

/** 智能拆解：调用 Dify 工作流，输入查询字符串 */
export async function callBreakdownAi(query: string): Promise<SubTask[]> {
  const raw = await callDify('breakdown', query);

  // 清理 markdown 代码块标记
  let jsonStr = raw.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

  const tasks = JSON.parse(jsonStr);
  if (!Array.isArray(tasks)) throw new Error('AI 返回格式异常');
  return tasks;
}

/** 会议分析：调用 Dify 工作流，输入会议纪要全文 */
export async function callMeetingAnalysis(query: string): Promise<MeetingResult> {
  const raw = await callDify('meeting', query);
  return JSON.parse(raw);
}

/** 兼容旧接口 —— 内部使用（已废弃，优先使用上面两个新函数） */
interface AiCallOptions {
  messages: { role: string; content: string }[];
}

export async function callAi(options: AiCallOptions): Promise<string> {
  const query = extractQuery(options.messages);
  if (!query) throw new Error('未找到有效的用户输入内容');
  return callDify('breakdown', query);
}
