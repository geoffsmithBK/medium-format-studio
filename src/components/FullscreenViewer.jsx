import React, { useState, useRef, useEffect, useCallback } from 'react';
import './FullscreenViewer.css';

/**
 * Fullscreen image viewer with three zoom levels and pan.
 *
 * Zoom states:
 *   fit    → image scaled to fill viewport (preserving aspect ratio)
 *   native → image at 1:1 pixel resolution
 *   200    → image at 2× native resolution (shift-click only)
 *
 * State machine:
 *   fit ──click──→ native ──click (no drag)──→ fit
 *   fit ──shift-click──→ 200
 *   native ──shift-click──→ 200
 *   200 ──any click (no drag)──→ native
 *
 * Pan is enabled in native/200 modes when the image exceeds the viewport.
 * Escape / X / backdrop click → close from any state.
 */
export default function FullscreenViewer({ imageUrl, alt, isOpen, onClose }) {
  const [zoomLevel, setZoomLevel] = useState('fit'); // 'fit' | 'native' | '200'
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, moved: false });
  const zoomToggledRef = useRef(false);

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      setZoomLevel('fit');
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

  const handleImageLoad = useCallback((e) => {
    setNaturalSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
  }, []);

  // Does image exceed viewport at each zoom level?
  const exceedsAtNative = naturalSize.w > window.innerWidth || naturalSize.h > window.innerHeight;
  const exceedsAt200 = naturalSize.w * 2 > window.innerWidth || naturalSize.h * 2 > window.innerHeight;
  const panEnabled = (zoomLevel === 'native' && exceedsAtNative) || (zoomLevel === '200' && exceedsAt200);

  // Compute explicit fitted dimensions (scales both up and down)
  const fittedDims = (() => {
    if (!naturalSize.w || !naturalSize.h) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / naturalSize.w, vh / naturalSize.h);
    return { width: naturalSize.w * scale, height: naturalSize.h * scale };
  })();

  // Unified zoom transition logic
  const transitionZoom = useCallback((shiftKey) => {
    if (zoomLevel === 'fit') {
      setZoomLevel(shiftKey ? '200' : 'native');
    } else if (zoomLevel === 'native') {
      setZoomLevel(shiftKey ? '200' : 'fit');
    } else { // '200' — any click goes to native
      setZoomLevel('native');
    }
    setPanOffset({ x: 0, y: 0 });
  }, [zoomLevel]);

  // ── Pan handlers ──────────────────────────────────────────────────

  const onMouseDown = useCallback((e) => {
    if (!panEnabled) return;
    e.preventDefault();
    dragRef.current = {
      dragging: true,
      startX: e.clientX - panOffset.x,
      startY: e.clientY - panOffset.y,
      moved: false,
    };
  }, [panEnabled, panOffset]);

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

  const onMouseUp = useCallback((e) => {
    if (!dragRef.current.dragging) return;
    const wasDrag = dragRef.current.moved;
    dragRef.current.dragging = false;
    if (!wasDrag) {
      transitionZoom(e.shiftKey);
      zoomToggledRef.current = true;
    }
  }, [transitionZoom]);

  // ── Click handler (for non-pan modes) ─────────────────────────────

  const handleImageClick = useCallback((e) => {
    e.stopPropagation();
    if (zoomToggledRef.current) {
      zoomToggledRef.current = false;
      return;
    }
    transitionZoom(e.shiftKey);
  }, [transitionZoom]);

  // ── Render ────────────────────────────────────────────────────────

  if (!isOpen) return null;

  // Compute image style and class based on zoom level
  let imageStyle = {};
  let imageClassName = 'fullscreen-image';

  if (zoomLevel === 'fit') {
    if (fittedDims) {
      imageStyle = { width: fittedDims.width, height: fittedDims.height, cursor: 'zoom-in' };
    } else {
      // Fallback before natural dimensions are known
      imageStyle = { maxWidth: '100%', maxHeight: '100%', cursor: 'zoom-in' };
    }
  } else if (zoomLevel === 'native') {
    imageClassName += ' fullscreen-image-zoomed';
    if (exceedsAtNative) {
      imageStyle = {
        transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
        cursor: dragRef.current.dragging ? 'grabbing' : 'grab',
      };
    } else {
      imageStyle = { cursor: 'zoom-out' };
    }
  } else { // '200'
    imageClassName += ' fullscreen-image-zoomed';
    if (exceedsAt200) {
      imageStyle = {
        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(2)`,
        cursor: dragRef.current.dragging ? 'grabbing' : 'grab',
      };
    } else {
      imageStyle = {
        transform: 'scale(2)',
        cursor: 'zoom-out',
      };
    }
  }

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
        className={imageClassName}
        style={imageStyle}
        onClick={handleImageClick}
        onMouseDown={onMouseDown}
        onLoad={handleImageLoad}
        draggable={false}
      />
    </div>
  );
}
