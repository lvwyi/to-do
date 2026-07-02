import { useState } from 'react';
import { useTodoApp } from '../hooks/useAppState';

export default function AddTodoInput() {
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
          data-focus-target="add-todo"
        />
        <button className="btn btn-primary" onClick={handleAdd}>✚ 添加</button>
      </div>
    </div>
  );
}
