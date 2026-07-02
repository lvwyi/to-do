import { useMemo } from 'react';
import { useTodoApp } from '../hooks/useAppState';
import { todayStr } from '../utils/helpers';

export default function StatsBar() {
  const { todos } = useTodoApp();

  const pct = useMemo(() => {
    const today = todayStr();
    const todayTodos = todos.filter(t => t.due === today);
    if (todayTodos.length === 0) return null;
    return Math.round(todayTodos.filter(t => t.completed).length / todayTodos.length * 100) + '%';
  }, [todos]);

  return (
    <div className="stats-bar">
      <div className="stats-header">
        <span className="stats-label">今日进度</span>
        <span className="stats-count">{pct ?? '--'}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: pct ?? '0%' }} />
      </div>
    </div>
  );
}
