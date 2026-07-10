import { useState } from 'react';
import { useTodoApp } from '../hooks/useAppState';
import { callAi, type AiMessage } from '../utils/aiApi';

interface SubTask {
  text: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
}

export default function AddTodoInput() {
  const { addTodo, categoryFilter, showToast } = useTodoApp();
  const [text, setText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const defaultCategory = categoryFilter ?? 'work';

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addTodo({ text: trimmed, description: '', priority: 'medium', category: defaultCategory, due: '', completed: false });
    setText('');
  };

  /**
   * 将用户的模糊输入（如"准备季度汇报"）拆成多个可执行的子任务，并批量添加。
   */
  const handleAiBreakdown = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setAiLoading(true);
    try {
      const messages: AiMessage[] = [
        {
          role: 'user',
          content: trimmed,
        },
      ];

      const raw = await callAi({ messages });
      let jsonStr = raw.trim();

      // 清理 LLM 可能包裹的 markdown 代码块标记
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

      const tasks: SubTask[] = JSON.parse(jsonStr);

      if (!Array.isArray(tasks) || tasks.length === 0) {
        showToast('AI 返回格式异常，已作为单条待办保存');
        addTodo({ text: trimmed, description: '', priority: 'medium', category: defaultCategory, due: '', completed: false });
        setText('');
        return;
      }

      for (const t of tasks) {
        addTodo({
          text: t.text,
          description: t.description ?? '',
          priority: t.priority as SubTask['priority'] ?? 'medium',
          category: defaultCategory,
          due: '',
          completed: false,
        });
      }

      showToast(`已拆解为 ${tasks.length} 个任务 ✨`);
      setText('');
    } catch {
      showToast('AI 拆解失败，请稍后重试');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="add-todo-area">
      <div className="add-todo-input-row">
        <input
          type="text"
          placeholder="添加新的待办事项… 回车即可保存"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          data-focus-target="add-todo"
        />
        <button className="btn btn-primary" onClick={handleAdd}>✚ 添加</button>
      </div>

      <div className="add-todo-ai-row">
        <button
          className="btn btn-ai"
          disabled={aiLoading || !text.trim()}
          onClick={handleAiBreakdown}
          title="用 AI 智能拆解为多个子任务"
        >
          {aiLoading ? '⏳ 拆解中…' : '✨ 智能拆解'}
        </button>
      </div>
    </div>
  );
}
