function Toast({ message, type = 'success' }) {
  if (!message) return null;

  return (
    <div className={`toast toast-${type}`} role={type === 'error' ? 'alert' : 'status'} aria-live="polite">
      <span className="toast-icon" aria-hidden="true">{type === 'success' ? '✓' : type === 'error' ? '!' : 'i'}</span>
      {message}
    </div>
  );
}

export default Toast;
