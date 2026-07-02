import { useMemo } from 'react';
import { useTodoApp } from '../hooks/useAppState';
import { todayStr, PRIORITY_ORDER } from '../utils/helpers';
import type { Todo } from '../types';
import TodoItem from './TodoItem';
import EmptyState from './EmptyState';

function getFilteredTodos(
  todos: Todo[],
  view: string,
  categoryFilter: string | null,
  search: string,
  sort: string,
): Todo[] {
  const today = todayStr();
  let filtered = [...todos];

  // View filter
  switch (view) {
    case 'today':
      filtered = filtered.filter(t => t.due === today && !t.completed);
      break;
    case 'upcoming':
      filtered = filtered.filter(t => {
        if (!t.due || t.completed) return false;
        const d = new Date(t.due + 'T00:00:00');
        const diff = (d.getTime() - Date.now()) / 86400000;
        return diff >= 0 && diff <= 7;
      });
      break;
    case 'completed':
      filtered = filtered.filter(t => t.completed);
      break;
    default:
      filtered = filtered.filter(t => !t.completed);
  }

  // Category filter
  if (categoryFilter) {
    filtered = filtered.filter(t => t.category === categoryFilter);
  }

  // Search
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(t =>
      t.text.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q))
    );
  }

  // Sort
  filtered.sort((a, b) => {
    switch (sort) {
      case 'created-desc': return b.createdAt - a.createdAt;
      case 'created-asc': return a.createdAt - b.createdAt;
      case 'priority-desc': return (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
      case 'priority-asc': return (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0);
      case 'due-asc': {
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due.localeCompare(b.due);
      }
      case 'alpha': return a.text.localeCompare(b.text, 'zh');
      default: return 0;
    }
  });

  return filtered;
}

export default function TodoList() {
  const { todos, view, categoryFilter, search, sort } = useTodoApp();
  const filtered = useMemo(
    () => getFilteredTodos(todos, view, categoryFilter, search, sort),
    [todos, view, categoryFilter, search, sort],
  );

  if (filtered.length === 0) {
    return <EmptyState view={view} search={search} />;
  }

  const active = filtered.filter(t => !t.completed);
  const completed = filtered.filter(t => t.completed);

  return (
    <div className="todo-list-container">
      {active.length > 0 && (
        <>
          <div className="todo-group-label">进行中 · {active.length}</div>
          {active.map(todo => <TodoItem key={todo.id} todo={todo} />)}
        </>
      )}
      {completed.length > 0 && (
        <>
          <div className="todo-group-label">已完成 · {completed.length}</div>
          {completed.map(todo => <TodoItem key={todo.id} todo={todo} />)}
        </>
      )}
    </div>
  );
}
