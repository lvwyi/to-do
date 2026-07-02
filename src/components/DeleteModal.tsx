import { useEffect, useState } from 'react';
import { useTodoApp } from '../hooks/useAppState';
import { escapeHtml } from '../utils/helpers';

export default function DeleteModal() {
  const { todos, deleteTodo, showToast, undoDelete } = useTodoApp();
  const [open, setOpen] = useState(false);
  const [todoId, setTodoId] = useState<string | null>(null);

  // Listen for events from TodoItem
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      console.log('[DeleteModal] open-delete received, id:', id);
      setTodoId(id);
      setOpen(true);
    };
    window.addEventListener('open-delete', handler);
    console.log('[DeleteModal] registering open-delete listener');
    return () => {
      window.removeEventListener('open-delete', handler);
      console.log('[DeleteModal] removing open-delete listener');
    };
  }, []);

  // Close on Escape key — MUST be before any early return (React rules)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!open || !todoId) return null;

  const todo = todos.find(t => t.id === todoId);
  if (!todo) return null;

  const handleConfirm = () => {
    console.log('[DeleteModal] confirming delete:', todoId);
    deleteTodo(todoId);
    setOpen(false);
    showToast(`"${todo.text}" 已删除`, () => undoDelete(todo));
  };

  return (
    <div className="modal-overlay modal-open" onClick={() => setOpen(false)}>
      <div className="modal" style={{ width: 340, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>&#x1F5D1;</div>
        <div className="modal-title" style={{ marginBottom: 8 }}>删除此事项？</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 0 }}>
          &ldquo;{escapeHtml(todo.text)}&rdquo; 将被永久删除
        </p>
        <div className="modal-actions" style={{ justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>取消</button>
          <button className="btn btn-danger" onClick={handleConfirm}>删除</button>
        </div>
      </div>
    </div>
  );
}
