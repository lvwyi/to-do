import { useTodoApp } from '../hooks/useAppState';

export default function ToastContainer() {
  const { toasts, removeToast } = useTodoApp();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div className="toast" key={toast.id}>
          <span>{toast.text}</span>
          <button
            className="undo-btn"
            onClick={() => {
              toast.undoAction();
              removeToast(toast.id);
            }}
          >
            撤销
          </button>
        </div>
      ))}
    </div>
  );
}
