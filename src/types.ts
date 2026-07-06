export interface Todo {
  id: string;
  text: string;
  description: string;
  priority: Priority;
  category: string;
  due: string; // YYYY-MM-DD
  completed: boolean;
  createdAt: number;
}

export type Priority = 'low' | 'medium' | 'high';

export interface Category {
  id: string;
  name: string;
  colorClass: string;
}

export interface AppState {
  todos: Todo[];
  categories: Category[];
}

export type ViewType = 'all' | 'today' | 'upcoming' | 'completed';

export type MainView = 'todos' | 'meeting';

export type SortOrder =
  | 'created-desc'
  | 'created-asc'
  | 'priority-desc'
  | 'priority-asc'
  | 'due-asc'
  | 'alpha';

export interface ToastMessage {
  id: string;
  text: string;
  undoAction?: () => void;
}
