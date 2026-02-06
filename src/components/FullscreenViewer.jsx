import React, { useState, useRef, useEffect, useCallback } from 'react';
import './FullscreenViewer.css';

/**
 * Fullscreen image viewer overlay with zoom and pan.
 *
 * Click image → 200% zoom with pan.
 * Click (without pan) in 200% → back to 100%.
 * Escape / X button / backdrop click → close.
 */
export default function FullscreenViewer({ imageUrl, alt, isOpen, onClose }) {
  const [zoomed, setZoomed] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, moved: false });
  const zoomToggledRef = useRef(false);

  // Reset zoom/pan when opening
  useEffect(() => {
    if (isOpen) {
      setZoomed(false);
      setPanOffset({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const onMouseDown = useCallback((e) => {
    if (!zoomed) return;
    e.preventDefault();
    dragRef.current = {
      dragging: true,
      startX: e.clientX - panOffset.x,
      startY: e.clientY - panOffset.y,
      moved: false,
    };
  }, [zoomed, panOffset]);

  const onMouseMove = useCallback((e) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const distFromStart = Math.abs(dx - panOffset.x) + Math.abs(dy - panOffset.y);
    if (distFromStart > 4) {
      dragRef.current.moved = true;
    }
    setPanOffset({ x: dx, y: dy });
  }, [panOffset]);

  const onMouseUp = useCallback(() => {
    if (!dragRef.current.dragging) return;
    const wasDrag = dragRef.current.moved;
    dragRef.current.dragging = false;
    if (!wasDrag && zoomed) {
      setZoomed(false);
      setPanOffset({ x: 0, y: 0 });
      zoomToggledRef.current = true;
    }
  }, [zoomed]);

  if (!isOpen) return null;

  return (
    <div
      className="fullscreen-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <button
        className="fullscreen-close"
        onClick={onClose}
        type="button"
        aria-label="Close"
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <img
        src={imageUrl}
        alt={alt || 'Image'}
        className={`fullscreen-image ${zoomed ? 'fullscreen-image-zoomed' : ''}`}
        style={zoomed ? {
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(2)`,
          cursor: dragRef.current.dragging ? 'grabbing' : 'grab',
        } : {
          cursor: 'zoom-in',
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (zoomToggledRef.current) {
            zoomToggledRef.current = false;
            return;
          }
          if (!zoomed) {
            setZoomed(true);
            setPanOffset({ x: 0, y: 0 });
          }
        }}
        onMouseDown={onMouseDown}
        draggable={false}
      />
    </div>
  );
}
