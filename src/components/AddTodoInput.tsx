import { useState } from 'react';
import { useTodoApp } from '../hooks/useAppState';

interface Props {
  onAIButtonClick?: () => void;
}

export default function AddTodoInput({ onAIButtonClick }: Props) {
  const { addTodo, categoryFilter } = useTodoApp();
  const [text, setText] = useState('');
  const defaultCategory = categoryFilter ?? 'work';

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addTodo({ text: trimmed, description: '', priority: 'medium', category: defaultCategory, due: '', completed: false });
    setText('');
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
        />
        {onAIButtonClick && (
          <button
            className="btn btn-ghost"
            onClick={onAIButtonClick}
            title="AI 智能拆解任务"
            style={{ borderStyle: 'dashed' }}
          >
            &#x1F916; AI
          </button>
        )}
        <button className="btn btn-primary" onClick={handleAdd}>✚ 添加</button>
      </div>
    </div>
  );
}
