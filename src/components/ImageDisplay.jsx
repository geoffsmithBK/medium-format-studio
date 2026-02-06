import React, { useState, useEffect, useRef } from 'react';
import FullscreenViewer from './FullscreenViewer';
import './ImageDisplay.css';

/**
 * Display generated image with download button and fullscreen viewer.
 *
 * Small images (native width < container) display at 1:1, centered.
 * Click zooms to fit (fills column width). Click again opens fullscreen.
 *
 * Large images display fitted to the column. Click opens fullscreen.
 */
export default function ImageDisplay({ imageUrl, prompt, aspectRatio }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isSmallImage, setIsSmallImage] = useState(false);
  const [inlineFitted, setInlineFitted] = useState(false);
  const containerRef = useRef(null);

  // Reset inline state when image changes
  useEffect(() => {
    setIsSmallImage(false);
    setInlineFitted(false);
  }, [imageUrl]);

  const handleImageLoad = (e) => {
    if (containerRef.current) {
      setIsSmallImage(e.target.naturalWidth < containerRef.current.clientWidth);
    }
  };

  const handleClick = () => {
    if (isSmallImage && !inlineFitted) {
      setInlineFitted(true);
    } else {
      setViewerOpen(true);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `comfyui-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!imageUrl) {
    return (
      <div className="image-display image-display-empty" style={aspectRatio ? { aspectRatio, minHeight: 'auto' } : undefined}>
        <div className="image-placeholder">
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p>Generated image will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="image-display" ref={containerRef}>
        <img
          src={imageUrl}
          alt={prompt || 'Generated image'}
          className="generated-image"
          onClick={handleClick}
          onLoad={handleImageLoad}
          style={{
            cursor: isSmallImage && !inlineFitted ? 'zoom-in' : 'pointer',
            width: inlineFitted ? '100%' : undefined,
          }}
        />
      </div>
      <button className="download-button" onClick={handleDownload} type="button">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download
      </button>

      <FullscreenViewer
        imageUrl={imageUrl}
        alt={prompt || 'Generated image'}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}
