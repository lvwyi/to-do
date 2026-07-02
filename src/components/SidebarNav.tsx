import { useMemo } from 'react';
import { useTodoApp } from '../hooks/useAppState';
import type { ViewType } from '../types';

const VIEWS: { key: ViewType; icon: string; label: string }[] = [
  { key: 'all', icon: '📋', label: '全部事项' },
  { key: 'today', icon: '☀️', label: '今天' },
  { key: 'upcoming', icon: '📅', label: '近期' },
  { key: 'completed', icon: '✅', label: '已完成' },
];

export default function SidebarNav() {
  const { view, todos, switchView } = useTodoApp();
  const today = new Date().toISOString().slice(0, 10);

  const counts = useMemo(() => ({
    all: todos.filter(t => !t.completed).length,
    today: todos.filter(t => !t.completed && t.due === today).length,
    upcoming: todos.filter(t => {
      if (!t.due || t.completed) return false;
      const d = new Date(t.due + 'T00:00:00');
      const diff = (d.getTime() - Date.now()) / 86400000;
      return diff >= 0 && diff <= 7;
    }).length,
    completed: todos.filter(t => t.completed).length,
  }), [todos, today]);

  return (
    <nav className="sidebar-section">
      <div className="sidebar-section-title">视图</div>
      {VIEWS.map(v => (
        <div
          key={v.key}
          className={`sidebar-item${view === v.key ? ' active' : ''}`}
          onClick={() => switchView(v.key)}
        >
          <span>{v.icon}</span>
          <span>{v.label}</span>
          <span className="count">{counts[v.key]}</span>
        </div>
      ))}
    </nav>
  );
}
