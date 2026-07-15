import React, { useEffect } from 'react';

export interface BannerState {
  kind: 'info' | 'error';
  message: string;
}

export function Banner({
  state,
  onClose,
}: {
  state: BannerState;
  onClose: () => void;
}): React.JSX.Element {
  useEffect(() => {
    if (state.kind === 'info') {
      const t = setTimeout(onClose, 4000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state, onClose]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        maxWidth: '80%',
        padding: '8px 14px',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        background: state.kind === 'error' ? '#ffe3e3' : '#e7f5ff',
        color: state.kind === 'error' ? '#c92a2a' : '#1864ab',
        font: '13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span>{state.message}</span>
      <button
        onClick={onClose}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 16,
          color: 'inherit',
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
