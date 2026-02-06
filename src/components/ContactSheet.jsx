import React from 'react';
import './ContactSheet.css';

/**
 * Thumbnail grid of recent generations.
 * Single click selects; double click opens fullscreen viewer.
 */
export default function ContactSheet({ items, selectedId, onSelect, onOpenViewer, isLoading, error }) {
  if (isLoading) {
    return <div className="contact-sheet-loading">Loading gallery...</div>;
  }

  if (error) {
    return <div className="contact-sheet-error">{error}</div>;
  }

  if (!items || items.length === 0) {
    return (
      <div className="contact-sheet-empty">
        <svg
          width="80"
          height="80"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <p>No images yet</p>
      </div>
    );
  }

  return (
    <div className="contact-sheet">
      <div className="contact-sheet-grid">
        {items.map((item) => (
          <div
            key={item.promptId}
            className={`contact-sheet-thumb${selectedId === item.promptId ? ' contact-sheet-thumb-selected' : ''}`}
            onClick={() => onSelect(item)}
            onDoubleClick={() => onOpenViewer(item)}
          >
            <img
              src={item.imageUrl}
              alt={item.filename}
              loading="lazy"
              draggable={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
