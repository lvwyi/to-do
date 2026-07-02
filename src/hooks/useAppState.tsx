import { createContext, useContext, useReducer, useCallback, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Todo, Category, AppState, ViewType, SortOrder, ToastMessage } from '../types';
import { loadState, saveState, THEME_KEY } from '../utils/storage';
import { genId } from '../utils/helpers';

interface Action {
  type: string;
  payload?: unknown;
}

/** Internal state shape — extends AppState with view/filter/search/sort */
interface InternalState extends AppState {
  _view: ViewType;
  _categoryFilter: string | null;
  _search: string;
  _sort: SortOrder;
}

/** Reducer managing all app state */
function reducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case 'ADD_TODO': {
      return { ...state, todos: [action.payload as Todo, ...state.todos] };
    }
    case 'TOGGLE_TODO': {
      return {
        ...state,
        todos: state.todos.map(t =>
          t.id === (action.payload as string) ? { ...t, completed: !t.completed } : t
        ),
      };
    }
    case 'UPDATE_TODO': {
      const { id, updates }: { id: string; updates: Partial<Todo> } = action.payload as { id: string; updates: Partial<Todo> };
      return {
        ...state,
        todos: state.todos.map(t =>
          t.id === id ? { ...t, ...updates } : t
        ),
      };
    }
    case 'DELETE_TODO': {
      return { ...state, todos: state.todos.filter(t => t.id !== (action.payload as string)) };
    }
    case 'UNDO_DELETE': {
      return { ...state, todos: [(action.payload as Todo), ...state.todos] };
    }
    case 'ADD_CATEGORY': {
      return { ...state, categories: [...state.categories, action.payload as Category] };
    }
    case 'DELETE_CATEGORY': {
      return {
        ...state,
        categories: state.categories.filter(c => c.id !== (action.payload as string)),
      };
    }
    case 'SET_VIEW': {
      return { ...state, _view: action.payload as ViewType };
    }
    case 'SET_CATEGORY_FILTER': {
      return { ...state, _categoryFilter: action.payload as string | null };
    }
    case 'SET_SEARCH': {
      return { ...state, _search: action.payload as string };
    }
    case 'SET_SORT': {
      return { ...state, _sort: action.payload as SortOrder };
    }
    default:
      return state;
  }
}

export interface TodoAppContextValue extends AppState {
  view: ViewType;
  categoryFilter: string | null;
  search: string;
  sort: SortOrder;
  theme: 'light' | 'dark';
  toasts: ToastMessage[];
  // Actions
  addTodo: (todo: Omit<Todo, 'id' | 'createdAt'>) => void;
  toggleTodo: (id: string) => void;
  updateTodo: (id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>) => void;
  deleteTodo: (id: string) => void;
  undoDelete: (todo: Todo) => void;
  addCategory: (cat: Omit<Category, 'colorClass'>) => void;
  deleteCategory: (id: string) => void;
  switchView: (view: ViewType) => void;
  switchCategory: (id: string | null) => void;
  setSearch: (q: string) => void;
  setSort: (s: SortOrder) => void;
  toggleTheme: () => void;
  showToast: (text: string, undoAction: () => void) => void;
  removeToast: (id: string) => void;
}

const Ctx = createContext<TodoAppContextValue | null>(null);

export function TodoProvider({ children }: { children: ReactNode }) {
  const raw = loadState();
  const init: InternalState = {
    ...raw,
    _view: 'all',
    _categoryFilter: null,
    _search: '',
    _sort: 'created-desc',
  };

  const [state, dispatch] = useReducer(reducer, init);

  // --- Theme state ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Persist theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  // --- Toast state ---
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Persist app state on change (todos + categories only)
  useEffect(() => {
    saveState({ todos: state.todos, categories: state.categories });
  }, [state.todos, state.categories]);

  // --- Action creators ---
  const addTodo = useCallback((data: Omit<Todo, 'id' | 'createdAt'>) => {
    dispatch({ type: 'ADD_TODO', payload: { ...data, id: genId(), createdAt: Date.now() } });
  }, []);

  const toggleTodo = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_TODO', payload: id });
  }, []);

  const updateTodo = useCallback((id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>) => {
    dispatch({ type: 'UPDATE_TODO', payload: { id, updates } });
  }, []);

  const deleteTodo = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TODO', payload: id });
  }, []);

  const undoDelete = useCallback((todo: Todo) => {
    dispatch({ type: 'UNDO_DELETE', payload: todo });
  }, []);

  const addCategory = useCallback((cat: Omit<Category, 'colorClass'>) => {
    dispatch({ type: 'ADD_CATEGORY', payload: { ...cat, colorClass: '' } });
  }, []);

  const deleteCategory = useCallback((id: string) => {
    dispatch({ type: 'DELETE_CATEGORY', payload: id });
  }, []);

  const switchView = useCallback((view: ViewType) => {
    dispatch({ type: 'SET_VIEW', payload: view });
    dispatch({ type: 'SET_CATEGORY_FILTER', payload: null });
  }, []);

  const switchCategory = useCallback((id: string | null) => {
    dispatch({ type: 'SET_CATEGORY_FILTER', payload: id });
    if (id === null) dispatch({ type: 'SET_VIEW', payload: 'all' });
  }, []);

  const setSearch = useCallback((q: string) => {
    dispatch({ type: 'SET_SEARCH', payload: q });
  }, []);

  const setSort = useCallback((s: SortOrder) => {
    dispatch({ type: 'SET_SORT', payload: s });
  }, []);

  const showToast = useCallback((text: string, undoAction: () => void) => {
    const id = genId();
    setToasts(prev => [...prev, { id, text, undoAction }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // --- Build context value from actual state ---
  const contextValue: TodoAppContextValue = {
    todos: state.todos,
    categories: state.categories,
    view: state._view,
    categoryFilter: state._categoryFilter,
    search: state._search,
    sort: state._sort,
    theme,
    toasts,
    addTodo, toggleTodo, updateTodo, deleteTodo, undoDelete,
    addCategory, deleteCategory, switchView, switchCategory,
    setSearch, setSort, toggleTheme, showToast, removeToast,
  };

  return (
    <Ctx.Provider value={contextValue}>
      {children}
    </Ctx.Provider>
  );
}

export function useTodoApp(): TodoAppContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTodoApp must be used within TodoProvider');
  return ctx;
}
