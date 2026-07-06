import { todayStr } from './helpers';

// ─── Public types ────────────────────────────────────────────────

export interface MeetingInfo {
  title: string;       // 会议/活动名称
  time: string;        // 时间（原始字符串，由解析器尽量标准化）
  participants: string[];
}

export interface MeetingDecision {
  id: string;
  content: string;     // 决议内容
}

export interface MeetingTask {
  id: string;
  content: string;     // 任务描述
  assignee: string;    // 负责人
  due: string;         // YYYY-MM-DD，未提取到时用 ''
}

export interface SpeechSummary {
  id: string;
  speaker: string;
  content: string;
}

export interface MeetingResult {
  info: MeetingInfo;
  topics: string[];          // 议题列表
  decisions: MeetingDecision[];
  tasks: MeetingTask[];      // 含截止时间信息的待办任务
  speeches: SpeechSummary[];
  cleanedText: string;       // 清洗后的正文
}

// ─── Helpers ─────────────────────────────────────────────────────

let _nextId = 0;
function uid(): string { return `m-${Date.now()}-${_nextId++}`; }

/** Normalize a date-like string to YYYY-MM-DD */
function normalizeDate(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();

  // Already YYYY-MM-DD
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // Chinese style YYYY年MM月DD日
  const cn = /(\d{4})[年](\d{1,2})[月](\d{1,2})[日]?/.exec(s);
  if (cn) {
    const [, y, m, d] = cn;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // MM/DD/YYYY
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (us) {
    const [, m, d, y] = us;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // MM-DD or MM/DD (assume current year)
  const short = /^(\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (short) {
    const [, m, d] = short;
    const y = new Date().getFullYear();
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  return s; // keep as-is
}

/** Determine closest valid date among candidates; fallback to today */
function pickDate(dates: string[]): string {
  for (const d of dates) {
    const normalized = normalizeDate(d);
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  }
  return todayStr();
}

// ─── Cleaning ────────────────────────────────────────────────────

function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t　]{2,}/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1)
    .join('\n');
}

// ─── Title extraction ────────────────────────────────────────────

function extractTitle(lines: string[]): string {
  for (const line of lines) {
    // "会议纪要" / "XX会议纪要" / "【XX】纪要" / "# XX会议纪要"
    const patterns = [
      /^(?:#\s*)?(?:【(.+?)】|《(.+?)》)?(.{2,30})会议纪要/,
      /^(?:#?\s*)[会议培训读书][^\n]{2,30}纪要/,
      /^(?:#?\s*)[^\n]{2,40}(?:总结|汇报|复盘)/,
      /^#{1,3}\s*[^\n]{2,50}/,
    ];
    for (const pat of patterns) {
      const m = line.match(pat);
      if (m) return line.replace(/^#+\s*/, '').trim();
    }
    // If it looks like a short header (no punctuation, 3-20 chars)
    if (/^.{3,30}$/.test(line) && !/[。；：]/.test(line) && /[a-zA-Z一-鿿]/.test(line)) {
      return line;
    }
    break; // stop at first non-header-looking line
  }
  return '会议纪要';
}

// ─── Time extraction ─────────────────────────────────────────────

function extractTime(lines: string[]): string {
  for (const line of lines) {
    // "会议时间：2025-03-15" / "时间：3月15日" / "于2025年3月15日举行"
    const patterns = [
      /(?:会议)?时[间于][：:\s]*([^\n，。；]+)/,
      /((?:20\d{2}|19\d{2})[年年](\d{1,2})[月月](\d{1,2})[日日]?)/,
      /((?:20\d{2}|19\d{2})[-/.]\d{1,2}[-/.]\d{1,2})/,
      /(\d{1,2}[月月]\d{1,2}[日日]?)/,
    ];
    for (const pat of patterns) {
      const m = line.match(pat);
      if (m) return m[1].trim();
    }
  }
  return todayStr(); // default to today
}

// ─── Participant extraction ──────────────────────────────────────

function extractParticipants(_text: string, lines: string[]): string[] {
  // Look for keywords like "参会人员", "出席", "参加", "参会人"
  for (const line of lines) {
    const m = line.match(/(?:参会人员|出席|参加|参会[人员]?)[：:\s]+(.+)/);
    if (m) {
      return parseNameList(m[1]);
    }
  }
  // Look for "缺席" to subtract
  return [];
}

function parseNameList(raw: string): string[] {
  // Split by common separators: 、 ， , / 和 与 &
  return raw
    .split(/[、，,，/　]*(?:和|与&|\*)\s*|[、，,，]/)
    .map(s => s.trim())
    .filter(Boolean);
}

// ─── Topics extraction ───────────────────────────────────────────

function extractTopics(cleaned: string): string[] {
  // Heuristic: lines containing issue/discussion keywords
  const result: string[] = [];
  for (const line of cleaned.split('\n')) {
    if (/^(?:议题|讨论|主题|重点)(?:讨论|分析)？？/.test(line)) continue; // skip headers
    // Look for numbered items after topic headers
    const numMatch = /^(\d+[.．、)][^\n]*)/.exec(line);
    if (numMatch && line.length < 200 && /[a-zA-Z一-鿿]/.test(line)) {
      result.push(numMatch[1].trim());
    }
  }
  if (result.length === 0) {
    // Fallback: use meaningful sentences
    const sentences = cleaned.split(/[。；!?！]/).map(s => s.trim()).filter(s => s.length > 5 && s.length < 200);
    return sentences.slice(0, 8);
  }
  return result.slice(0, 15);
}

// ─── Decisions extraction ────────────────────────────────────────

function extractDecisions(cleaned: string): MeetingDecision[] {
  const result: MeetingDecision[] = [];
  // Keywords: 决定/决议/确认/通过/明确/结论/定下来了
  const lines = cleaned.split('\n');
  let inDecisions = false;
  for (const line of lines) {
    const isHeader = /(?:正式)?决议(?:事项)?|(?:已)?确认的事项|决定|结论/.test(line);
    if (isHeader) { inDecisions = true; continue; }
    if (inDecisions && /^[\-\*•]/.test(line)) {
      result.push({ id: uid(), content: line.replace(/^[\-\*•]+\s*/, '').trim() });
      continue;
    }
    if (inDecisions && /^(\d+[.．、])[^\n]*$/.test(line)) {
      result.push({ id: uid(), content: line.replace(/^\d+[.．、]\s*/, '').trim() });
      continue;
    }
    // If we hit another section header, stop collecting decisions
    if (inDecisions && /^(?:待办|任务|行动|下一步|发言|议题)/.test(line)) {
      inDecisions = false;
    }
  }
  // Fallback: look for sentences with decision keywords
  if (result.length === 0) {
    const sentences = cleaned.split(/[。；!！]/).map(s => s.trim()).filter(s =>
      /(决定|确定|确认|通过|定下来|一致同意|达成共识)/.test(s) && s.length < 150
    );
    return sentences.map(s => ({ id: uid(), content: s })).slice(0, 10);
  }
  return result;
}

// ─── Task extraction ─────────────────────────────────────────────

function extractTasks(cleaned: string): MeetingTask[] {
  const result: MeetingTask[] = [];
  const lines = cleaned.split('\n');

  // We try multiple extraction strategies
  const strategies: Array<(lines: string[], cleaned: string) => MeetingTask[]> = [
    numberedItemsStrategy,
    bulletStrategy,
    keywordStrategy,
    sentenceStrategy,
  ];

  for (const strategy of strategies) {
    const found = strategy(lines, cleaned);
    if (found.length >= 1) return found;
  }

  return result;
}

/** Strategy: numbered lists under "待办/任务" sections */
function numberedItemsStrategy(lines: string[], _cleaned: string): MeetingTask[] {
  const result: MeetingTask[] = [];
  let inTaskSection = false;

  for (const line of lines) {
    const sectionHeader = /^(?:待办|任务清单|行动项|下一步行动|跟进|TODO|待办任务)/i.test(line);
    if (sectionHeader) { inTaskSection = true; continue; }
    if (inTaskSection && /^(\d+[.．、)][^\n]+)/.test(line)) {
      result.push(parseTaskLine(line.replace(/^\d+[.．、]\s*/, '')));
    } else if (inTaskSection && /^[\-\*•][^\n]+/.test(line)) {
      result.push(parseTaskLine(line.replace(/^[\-\*•]+\s*/, '')));
    } else if (inTaskSection && /^(\[[xX\-]\])\s*/.test(line)) {
      result.push(parseTaskLine(line.replace(/^\[[xX\-]\]\s*/, '')));
    }
    // Exit if another major section starts
    if (inTaskSection && /^(?:议题|发言|决议|参会|纪要|一、|二、|三、)/.test(line)) {
      inTaskSection = false;
    }
  }
  return result;
}

/** Strategy: bulleted lists anywhere */
function bulletStrategy(lines: string[], _cleaned: string): MeetingTask[] {
  const result: MeetingTask[] = [];
  for (const line of lines) {
    // Check for task-related bullets
    if (/^[\-\*•]\s*[^\n]+$/.test(line.trim())) {
      const content = line.trim().replace(/^[\-\*•]+\s*/, '');
      if (hasTaskIndicator(content)) {
        result.push(parseTaskLine(content));
      }
    }
  }
  return result;
}

/** Strategy: sentences with action-oriented keywords */
function keywordStrategy(_lines: string[], cleaned: string): MeetingTask[] {
  const result: MeetingTask[] = [];
  const sentences = cleaned.split(/[。；!！]/).map(s => s.trim()).filter(s => s.length > 3);
  for (const s of sentences) {
    if (hasTaskIndicator(s) && s.length < 200) {
      result.push(parseTaskLine(s));
    }
  }
  return result.slice(0, 15);
}

/** Strategy: last resort — find any imperative/actionable sentences */
function sentenceStrategy(_lines: string[], cleaned: string): MeetingTask[] {
  const result: MeetingTask[] = [];
  const sentences = cleaned.split(/[。；!！]/).map(s => s.trim()).filter(s =>
    s.length > 5 && s.length < 200
  );
  // Take up to 10 sentences that sound actionable
  const actionWords = ['需要', '应该', '负责', '完成', '制定', '准备', '提交', '更新', '联系', '安排', '整理', '编写', '设计', '开发', '测试'];
  for (const s of sentences) {
    if (actionWords.some(w => s.includes(w))) {
      result.push(parseTaskLine(s));
      if (result.length >= 10) break;
    }
  }
  return result;
}

function hasTaskIndicator(sentence: string): boolean {
  const indicators = ['需要', '负责', '完成', '制定', '准备', '提交', '更新', '联系', '安排', '整理', '编写', '设计', '开发', '测试', '跟进', '落实', '协调', '确认', '审核', '批准', '组织', '开展', '推进', '处理', '解决', '回复', '发送', '建立', '完善', '优化', '减少', '增加'];
  return indicators.some(w => sentence.includes(w));
}

// ─── Task line parser ────────────────────────────────────────────

interface TaskFields {
  content: string;
  assignee: string;
  dates: string[];
}

function parseTaskLine(raw: string): MeetingTask {
  const fields = extractTaskFields(raw);
  return {
    id: uid(),
    content: fields.content,
    assignee: fields.assignee || '待定',
    due: pickDate(fields.dates),
  };
}

function extractTaskFields(raw: string): TaskFields {
  const assignees: string[] = [];
  const dates: string[] = [];

  // --- Extract assignees ---
  const assigneePatterns = [
    /(?:负责人|assignee|责任人|执行人|承办|牵头|由|安排|指定)[:：\s]*(.+?)(?:，|,|。|；|\n|$)/,
    /(?:([^，,]{2,6})(?:等\d人)?)(?:[:：]\s*(?:负责|执行|牵头|完成))/,
  ];
  for (const pat of assigneePatterns) {
    const m = raw.match(pat);
    if (m && m[1]) assignees.push(...parseNameList(m[1]));
  }
  // If the whole raw string is just a name + colon + description
  const allNames = [...assignees];

  // --- Extract dates ---
  const datePatterns = [
    /(?:截止时间|deadline|期限|完成(?:日期|时间)?|计划|预计)[:：\s]*([^\n，。；]+)/,
    /((?:20\d{2}|19\d{2})[年年]\d{1,2}[月月]\d{1,2}[日日]?)/,
    /((?:20\d{2}|19\d{2})[-/.]\d{1,2}[-/.]\d{1,2})/,
    /((?:本|下|明)(?:周|天|月)(?:[初十一二三四五六七八九十]?\d?[日号])?)/,
    /(\d{1,2}[月月]\d{1,2}[日日]?)/,
    /((?:这|下|下下周|今|明)天)/,
  ];
  for (const pat of datePatterns) {
    const m = raw.match(pat);
    if (m) dates.push(m[1].trim());
  }

  // Resolve relative dates
  const resolvedDates: string[] = [];
  for (const d of dates) {
    if (d === '今天' || d === '本日') resolvedDates.push(todayStr());
    else if (d === '明天' || d === '明日') resolvedDates.push(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    else if (d === '后天' || d === '日') resolvedDates.push(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
    else if (/这周/.test(d)) resolvedDates.push(nearestMonday().toISOString().slice(0, 10));
    else if (/下周/.test(d)) resolvedDates.push(nextWeekMonday().toISOString().slice(0, 10));
    else if (/下下周/.test(d)) resolvedDates.push(nextNextWeekMonday().toISOString().slice(0, 10));
    else resolvedDates.push(d);
  }

  // --- Content: remove assignee/date annotations ---
  let content = raw;
  // Remove known annotation patterns
  content = content
    .replace(/(?:负责人|assignee|责任人|执行人|承办|牵头)[:：\s]*[^，,。；\n]+/gi, '')
    .replace(/(?:截止|完成|计划|预计|期限)[:：\s]*[^，,。；\n]+/gi, '')
    .replace(/(?:由|安排|指定)[^，,。；\n]+(?=[：:\s]*(?:负责|执行))/g, '')
    .replace(/^[\-*•\[\]]+\s*/, '')
    .replace(/^\d+[.．、]\s*/, '')
    .trim();

  return { content, assignee: allNames.join('、'), dates: resolvedDates };
}

/** Next Monday (or today if already Monday) */
function nearestMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? 6 : day - 1);
  const mon = new Date(now);
  mon.setDate(now.getDate() - diff);
  return mon;
}

function nextWeekMonday(): Date {
  return new Date(Date.now() + 7 * 86400000);
}

function nextNextWeekMonday(): Date {
  return new Date(Date.now() + 14 * 86400000);
}

// ─── Speech summaries ────────────────────────────────────────────

function extractSpeeches(participants: string[], cleaned: string): SpeechSummary[] {
  if (participants.length === 0) return [];
  const result: SpeechSummary[] = [];
  const lines = cleaned.split('\n');

  for (const line of lines) {
    // Detect "张三：" / "[张三]" / "— 李四 —"
    for (const name of participants) {
      if (new RegExp(`(?:^|[\\n\\[{——])(?:${escapeRe(name)})[:：]\\s*(.+)|\\[${escapeRe(name)}\\]\\s*([^{\\n]+)`).test(line)) {
        const match = line.match(new RegExp(`(?:^|[\\n\\[{——])(?:${escapeRe(name)})[:：]\\s*(.+)`));
        if (match && match[1]) {
          result.push({ id: uid(), speaker: name, content: match[1].trim() });
        }
        break;
      }
    }
  }

  return result.slice(0, 30);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Main entry ──────────────────────────────────────────────────

export function parseMeeting(text: string): MeetingResult {
  const cleaned = cleanText(text);
  const lines = cleaned.split('\n');

  const title = extractTitle(lines);
  const time = extractTime(lines);
  const participants = extractParticipants(cleaned, lines);
  const topics = extractTopics(cleaned);
  const decisions = extractDecisions(cleaned);
  const tasks = extractTasks(cleaned);
  const speeches = extractSpeeches(participants, cleaned);

  return {
    info: { title, time, participants },
    topics,
    decisions,
    tasks,
    speeches,
    cleanedText: cleaned,
  };
}
