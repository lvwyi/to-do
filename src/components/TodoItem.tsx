import { useTodoApp } from '../hooks/useAppState';
import { formatDate, isOverdue, escapeHtml } from '../utils/helpers';
import type { Todo } from '../types';

interface Props {
  todo: Todo;
}

export default function TodoItem({ todo }: Props) {
  const { toggleTodo, categories } = useTodoApp();
  const cat = categories.find(c => c.id === todo.category);
  const overdue = !todo.completed && todo.due && isOverdue(todo.due);

  return (
    <div className={`todo-item${todo.completed ? ' completed' : ''}`} data-id={todo.id}>
      <div className={`todo-priority-bar ${todo.priority}`} />
      <div
        className={`todo-checkbox${todo.completed ? ' checked' : ''}`}
        onClick={() => toggleTodo(todo.id)}
      />
      <div className="todo-content">
        <div className="todo-text">{escapeHtml(todo.text)}</div>
        {todo.description && (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 4 }}>
            {escapeHtml(todo.description)}
          </div>
        )}
        {(todo.due || cat) && (
          <div className="todo-meta">
            {todo.due && (
              <span className={`todo-tag${overdue ? ' tag-overdue' : ' tag-date'}`}>
                {overdue ? '⚠ ' : '📅 '}
                {formatDate(todo.due)}{overdue ? ' (逾期)' : ''}
              </span>
            )}
            {cat && (
              <span className={`todo-tag ${cat.colorClass ?? 'cat-work'}`}>{cat.name}</span>
            )}
          </div>
        )}
      </div>
      <div className="todo-actions">
        <button className="action-btn" title="编辑" onClick={() => {
          const event = new CustomEvent('open-edit', { detail: todo.id });
          window.dispatchEvent(event);
        }}>&#9998;</button>
        <button className="action-btn delete" title="删除" onClick={() => {
          const event = new CustomEvent('open-delete', { detail: todo.id });
          window.dispatchEvent(event);
        }}>&#x1F5D1;</button>
      </div>
    </div>
  );
}
