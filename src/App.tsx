import { useEffect } from 'react';
import { TodoProvider } from './hooks/useAppState';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import AddTodoInput from './components/AddTodoInput';
import TodoList from './components/TodoList';
import EditModal from './components/EditModal';
import DeleteModal from './components/DeleteModal';
import ToastContainer from './components/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import './css/global.css';

function InnerApp() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[data-focus-target="search"]')?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[data-focus-target="add-todo"]')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar />
        <AddTodoInput />
        <TodoList />
      </main>
      <EditModal />
      <DeleteModal />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <TodoProvider>
      <ErrorBoundary>
        <InnerApp />
      </ErrorBoundary>
    </TodoProvider>
  );
}
