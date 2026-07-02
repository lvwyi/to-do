import type { Category } from '../types';

/** Result of task decomposition */
export interface DecompositionResult {
  id: string;
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
}

const MODEL_MAP: Record<string, string> = {
  'qwen-turbo': 'qwen-turbo',
  'qwen-plus': 'qwen-plus',
  'qwen-max': 'qwen-max',
  'qwen-flash': 'qwen3.6-flash',
  'qwen3.6-flash': 'qwen3.6-flash',
};

const DEFAULT_MODEL = 'qwen3.6-flash';

/** Normalize a single parsed entry into a standard DecompositionResult */
function normalizeEntry(entry: unknown): DecompositionResult | null {
  if (!entry || typeof entry !== 'object') return null;
  const obj = entry as Record<string, unknown>;

  const name = String(obj.name ?? obj.text ?? obj.title ?? '');
  if (!name.trim()) return null;

  const priorityStr = String(obj.priority ?? '').toLowerCase();
  const priority: DecompositionResult['priority'] =
    ['high', 'h', '高'].includes(priorityStr) ? 'high'
    : ['low', 'l', '低'].includes(priorityStr) ? 'low'
    : 'medium';

  const description = String(obj.description ?? obj.desc ?? '') || '';
  const category = String(obj.category ?? obj.cat ?? '') || 'work';

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    description,
    priority,
    category,
  };
}

/** Extract JSON array from raw LLM response text */
function extractJsonArray(raw: string): string | null {
  // Try ```json ... ``` block first
  const jsonBlock = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  if (jsonBlock) {
    const cleaned = jsonBlock[1].trim();
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch { /* fall through */ }
  }

  // Fallback: find first [ and last ]
  const firstBracket = raw.indexOf('[');
  const lastBracket = raw.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const candidate = raw.slice(firstBracket, lastBracket + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch { /* fall through */ }
  }

  return null;
}

/** Build system prompt for the LLM */
function buildSystemPrompt(): string {
  return [
    '你是一个专业的项目管理助手和任务拆解专家。',
    '',
    '你的职责：将用户描述的大型任务/项目，科学地拆解为多个可独立执行的小任务。',
    '',
    '拆解原则：',
    '1. 每个子任务都必须是具体的、可执行的行动项（不是模糊的概述）',
    '2. 子任务之间相互独立，按逻辑顺序排列',
    '3. 粒度适中 — 单个子任务应在30分钟内可完成',
    '4. 覆盖完整范围，不遗漏关键步骤',
    '5. 为每个子任务标注优先级（high/medium/low），并根据任务类型分配合适的分类',
    '',
    '【重要】你的回复必须是一个合法的 JSON 数组，包含在 ```json 代码块中。不要添加任何其他文字或解释。',
    '',
    'JSON 格式示例：',
    '```json',
    '[',
    '  {',
    '    "name": "设计数据库 schema",',
    '    "description": "定义核心表结构及字段关系",',
    '    "priority": "high",',
    '    "category": "开发"',
    '  },',
    '  {',
    '    "name": "编写登录页面 UI",',
    '    "description": "",',
    '    "priority": "medium",',
    '    "category": "前端"',
    '  }',
    ']',
    '```',
  ].join('\n');
}

/** Build user prompt */
function buildUserPrompt(description: string, context: string): string {
  const parts = [description];
  if (context.trim()) parts.push(`补充信息：${context}`);
  return parts.join('\n\n').trim();
}

/**
 * Call LLM API to decompose a high-level task into subtasks.
 * Returns parsed subtask array or throws on failure.
 */
export async function decomposeTask(
  description: string,
  context: string = '',
  categories: Category[] = [],
): Promise<DecompositionResult[]> {
  if (!description.trim()) throw new Error('请输入任务描述');

  const apiKey = import.meta.env.VITE_DASHSCOPE_API_KEY;
  const modelKey = import.meta.env.VITE_DASHSCOPE_MODEL ?? 'qwen3.6-flash';
  const model = MODEL_MAP[modelKey] || DEFAULT_MODEL;
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  const proxyPath = '/api/dashscope';

  if (!apiKey) {
    throw new Error('未配置 API Key。请在 .env.local 文件中设置 VITE_DASHSCOPE_API_KEY，参考 .env.example');
  }

  /** Build the full target URL for the LLM API call.
   * In dev mode, routes through Vite's configured proxy to keep the key off-browser.
   * In production (no proxy), falls back to the raw DashScope endpoint. */
  function buildEndpoint(): string {
    if (!baseUrl) return `${proxyPath}/chat/completions`; // safety fallback

    const isProxy = /^https?:\/\//i.test(baseUrl);
    let path: string;

    if (isProxy) {
      const slashIdx = baseUrl.indexOf('/', 8); // past protocol
      path = slashIdx === -1 ? proxyPath : baseUrl.slice(slashIdx);
    } else {
      path = baseUrl.endsWith('/') ? baseUrl + 'chat/completions' : '/' + baseUrl + '/chat/completions';
    }

    if (import.meta.env.DEV) {
      // Dev: use the proxied path so Vite's auth header takes over
      return proxyPath + path.replace('/dashscope', '');
    }

    // Prod: no server → hit DashScope directly from browser
    return path.startsWith('/api/') ? `https://dashscope.aliyuncs.com${path}` : path;
  }

  const endpoint = buildEndpoint();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-DashScope-Api-Key': apiKey,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(description, context) },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new Error('API Key 无效，请检查配置是否正确');
    }
    if (response.status === 429) {
      throw new Error('请求过于频繁，请稍后再试');
    }
    throw new Error(`API 请求失败 (${response.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  if (!message || !message.content) {
    throw new Error('AI 返回的数据格式异常，请重试');
  }

  const rawText = message.content.trim();
  const jsonString = extractJsonArray(rawText);
  if (!jsonString) {
    throw new Error(`无法解析 AI 返回的内容，请重新尝试。\n\n原始内容：${rawText.slice(0, 300)}...`);
  }

  const items = JSON.parse(jsonString) as unknown[];
  if (!Array.isArray(items)) {
    throw new Error('AI 返回的格式不正确，期望一个数组');
  }

  const results: DecompositionResult[] = [];
  for (const item of items) {
    const parsed = normalizeEntry(item);
    if (parsed) {
      if (categories.length > 0 && !categories.find(c => c.name === parsed.category)) {
        parsed.category = categories[0].id;
      }
      results.push(parsed);
    }
  }

  if (results.length === 0) {
    throw new Error('未能从 AI 返回中提取到有效的子任务，请调整描述后重试');
  }

  return results;
}
