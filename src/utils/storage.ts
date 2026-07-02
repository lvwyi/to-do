import type { AppState } from '../types';

const STORAGE_KEY = 'todo-app-data-v3';
export const THEME_KEY = 'todo-theme';

const DEFAULT_CATEGORIES: AppState['categories'] = [
  { id: 'work',       name: '工作',     colorClass: 'cat-work' },
  { id: 'personal',   name: '个人',     colorClass: 'cat-personal' },
  { id: 'health',     name: '健康',     colorClass: 'cat-health' },
  { id: 'study',      name: '学习',     colorClass: 'cat-study' },
  { id: 'shopping',   name: '购物',     colorClass: 'cat-shopping' },
];

export function createDefaultState(): AppState {
  return {
    todos: [],
    categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
  };
}

function mergeDefaults(s: Partial<AppState>): AppState {
  const cats = s.categories || [];
  DEFAULT_CATEGORIES.forEach(def => {
    if (!cats.find(c => c.id === def.id)) cats.push({ ...def });
  });
  return {
    todos: s.todos ?? [],
    categories: cats,
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return mergeDefaults(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[storage] save failed:', err);
  }
}
