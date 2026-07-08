import { useTodoApp } from '../hooks/useAppState';

export default function ToastContainer() {
  const { toasts } = useTodoApp();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div className="toast" key={toast.id}>
          <span>{toast.text}</span>
          {toast.undoAction && (
            <button
              className="undo-btn"
              onClick={() => {
                // Execute undo callback — captures the exact deleted todo at creation time.
                // No manual removeToast call: the 5s auto-timer handles cleanup.
                // This eliminates the race condition where removeToast could fire before re-render completes.
                toast.undoAction && toast.undoAction();
              }}
            >
              撤销
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
