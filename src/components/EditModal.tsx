import { useEffect, useState } from 'react';
import { useTodoApp } from '../hooks/useAppState';
import { escapeHtml } from '../utils/helpers';

export default function EditModal() {
  const { todos, categories, updateTodo } = useTodoApp();
  const [open, setOpen] = useState(false);
  const [todoId, setTodoId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('work');
  const [due, setDue] = useState('');

  // Listen for events from TodoItem
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      console.log('[EditModal] open-edit event received, id:', id);
      const todo = todos.find(t => t.id === id);
      if (!todo) {
        console.warn('[EditModal] todo not found for id:', id);
        return;
      }
      setTodoId(id);
      setText(todo.text);
      setDescription(todo.description || '');
      setPriority(todo.priority);
      setCategory(todo.category);
      setDue(todo.due);
      setOpen(true);
    };
    window.addEventListener('open-edit', handler);
    console.log('[EditModal] registering open-edit listener');
    return () => {
      window.removeEventListener('open-edit', handler);
      console.log('[EditModal] removing open-edit listener');
    };
  	}, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const handleSave = () => {
    if (!todoId || !text.trim()) return;
    console.log('[EditModal] saving:', { id: todoId, text: text.trim() });
    updateTodo(todoId, { text: text.trim(), description: description.trim(), priority, category, due });
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay modal-open" onClick={() => setOpen(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">编辑事项</div>
        <div className="form-group">
          <label>内容</label>
          <input
            type="text"
            placeholder="待办内容"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>描述</label>
          <textarea
            placeholder="补充描述（可选）"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>优先级</label>
          <select value={priority} onChange={e => setPriority(e.target.value as typeof priority)}>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </div>
        <div className="form-group">
          <label>分类</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{escapeHtml(c.name)}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>到期日期</label>
          <input
            type="date"
            value={due}
            onChange={e => setDue(e.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}
