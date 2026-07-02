import { useTodoApp } from '../hooks/useAppState';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTodoApp();
  return (
    <button className="theme-toggle" onClick={toggleTheme}>
      {theme === 'dark' ? '☀️ 浅色模式' : '🌙 深色模式'}
    </button>
  );
}
