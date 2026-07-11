/**
 * AI 客户端 —— Dify Cloud 平台版
 * - Web 模式：通过本地代理转发请求，避免 API Key 暴露给浏览器
 */

const AI_API_ENDPOINT = '/api/ai';

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

/** 代理返回的标准响应格式 */
interface ProxyResponse {
  success?: boolean;
  content?: string;
  error?: string;
}

// ---- 共享 fetch 逻辑 ----

async function callDify(type: 'breakdown' | 'meeting', query: string): Promise<string> {
  const res = await fetch(`${AI_API_ENDPOINT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, query }),
  });

  if (!res.ok) {
    throw new Error(`AI 请求失败 (${res.status})`);
  }

  const data: ProxyResponse = await res.json();

  // 检查代理层是否有错误
  if (data.error) throw new Error(data.error);
  if (!data.success || !data.content) throw new Error('AI 未返回有效内容');

  return data.content;
}

/** 智能拆解：调用 Dify 工作流，输入查询字符串 */
export async function callBreakdownAi(query: string): Promise<SubTask[]> {
  const raw = await callDify('breakdown', query);

  // 清理 markdown 代码块标记（如 ```json ... ``` 或 ``` ... ```)
  let jsonStr = raw.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

  try {
    const tasks = JSON.parse(jsonStr);
    if (!Array.isArray(tasks)) throw new Error('AI 返回格式异常');
    return tasks;
  } catch (err) {
    console.error('[AI Parse Error] Failed to parse task list:', err);
    console.error('[AI Parse Error] Raw content preview:', jsonStr.slice(0, 300));
    throw new Error(`AI 返回格式异常（${(err as Error).message}）`);
  }
}

/** 会议分析：调用 Dify 工作流，输入会议纪要全文 */
export async function callMeetingAnalysis(query: string): Promise<MeetingResult> {
  const raw = await callDify('meeting', query);
  return JSON.parse(raw);
}
