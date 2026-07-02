import { useState, useEffect } from 'react';
import { TodoProvider } from './hooks/useAppState';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import AddTodoInput from './components/AddTodoInput';
import TodoList from './components/TodoList';
import EditModal from './components/EditModal';
import DeleteModal from './components/DeleteModal';
import ToastContainer from './components/ToastContainer';
import AIDecomposeModal from './components/AIDecomposeModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import './css/global.css';

function InnerApp() {
  const [aiModalOpen, setAiModalOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('.search-box input')?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('.add-todo-input-row input')?.focus();
      }
      if (e.key === 'Escape' && aiModalOpen) {
        setAiModalOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [aiModalOpen]);

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar />
        <AddTodoInput onAIButtonClick={() => setAiModalOpen(true)} />
        <TodoList />
      </main>
      <EditModal />
      <DeleteModal />
      <ToastContainer />
      <AIDecomposeModal open={aiModalOpen} onClose={() => setAiModalOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TodoProvider>
        <InnerApp />
      </TodoProvider>
    </ErrorBoundary>
  );
}
