import { useState, useEffect } from 'react';
import { TodoProvider } from './hooks/useAppState';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import AddTodoInput from './components/AddTodoInput';
import TodoList from './components/TodoList';
import EditModal from './components/EditModal';
import DeleteModal from './components/DeleteModal';
import ToastContainer from './components/ToastContainer';
import MeetingPanel from './components/MeetingPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import './css/global.css';

/** View modes */
type MainView = 'todos' | 'meeting';

function InnerApp() {
  const [mainView, setMainView] = useState<MainView>('todos');

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
      // Ctrl+Shift+M → switch to meeting panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        setMainView(prev => prev === 'todos' ? 'meeting' : 'todos');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar onMeetingClick={() => setMainView(prev => prev === 'meeting' ? 'todos' : 'meeting')} currentView={mainView} />

        {/* Mode tabs below topbar */}
        <div className="view-tabs">
          <button
            className={`view-tab ${mainView === 'todos' ? 'active' : ''}`}
            onClick={() => setMainView('todos')}
          >
            ✅ 待办事项
          </button>
          <button
            className={`view-tab ${mainView === 'meeting' ? 'active' : ''}`}
            onClick={() => setMainView('meeting')}
          >
            🤖 会议智能助手
          </button>
        </div>

        {mainView === 'todos' ? (
          <>
            <AddTodoInput />
            <TodoList />
          </>
        ) : (
          <MeetingPanel />
        )}
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
