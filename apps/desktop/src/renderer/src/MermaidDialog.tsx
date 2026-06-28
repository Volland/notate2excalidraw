import React, { useState } from 'react';

const SAMPLE = `graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Do thing]
  B -->|No| D[Skip]
  C --> E[End]
  D --> E`;

export function MermaidDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (definition: string) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [text, setText] = useState(SAMPLE);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          width: 560,
          maxWidth: '90%',
          background: '#fff',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
          font: '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Import Mermaid</h2>
        <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
          Paste a Mermaid diagram. It is added to the canvas as Excalidraw shapes;
          saving as <code>.notate</code> converts shapes into pen strokes.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            height: 220,
            boxSizing: 'border-box',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 13,
            padding: 10,
            border: '1px solid #ccc',
            borderRadius: 8,
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button onClick={onCancel} style={btn(false)}>
            Cancel
          </button>
          <button onClick={() => onSubmit(text)} style={btn(true)}>
            Add to canvas
          </button>
        </div>
      </div>
    </div>
  );
}

function btn(primary: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 8,
    border: primary ? 'none' : '1px solid #ccc',
    background: primary ? '#1971c2' : '#fff',
    color: primary ? '#fff' : '#333',
    cursor: 'pointer',
    fontSize: 14,
  };
}
