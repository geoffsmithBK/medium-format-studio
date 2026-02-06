import React, { useState } from 'react';
import './MetadataPanel.css';

/**
 * Sidebar metadata display for a selected gallery image.
 * Shows preview, prompt with copy button, and parameter grid.
 */
export default function MetadataPanel({ imageUrl, filename, metadata }) {
  const [copied, setCopied] = useState(false);

  if (!imageUrl) {
    return (
      <div className="metadata-panel-empty">
        Select an image to view its generation parameters
      </div>
    );
  }

  const handleCopy = async () => {
    if (!metadata?.prompt) return;
    try {
      await navigator.clipboard.writeText(metadata.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const dims = metadata?.width && metadata?.height
    ? `${metadata.width} x ${metadata.height}`
    : null;

  return (
    <div className="metadata-panel">
      <div className="metadata-preview">
        <img src={imageUrl} alt={filename || 'Selected image'} />
      </div>

      {metadata?.prompt && (
        <div className="metadata-prompt-section">
          <div className="metadata-prompt-header">
            <span className="metadata-label">Prompt</span>
            <button
              type="button"
              className="metadata-copy-btn"
              onClick={handleCopy}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="metadata-prompt-text">{metadata.prompt}</div>
        </div>
      )}

      <div className="metadata-params">
        {metadata?.seed != null && (
          <div className="metadata-param">
            <span className="metadata-label">Seed</span>
            <span className="metadata-param-value">{metadata.seed}</span>
          </div>
        )}
        {metadata?.model && (
          <div className="metadata-param">
            <span className="metadata-label">Model</span>
            <span className="metadata-param-value">{metadata.model}</span>
          </div>
        )}
        {dims && (
          <div className="metadata-param">
            <span className="metadata-label">Dimensions</span>
            <span className="metadata-param-value">{dims}</span>
          </div>
        )}
        {metadata?.steps != null && (
          <div className="metadata-param">
            <span className="metadata-label">Steps</span>
            <span className="metadata-param-value">{metadata.steps}</span>
          </div>
        )}
        {metadata?.cfg != null && (
          <div className="metadata-param">
            <span className="metadata-label">CFG</span>
            <span className="metadata-param-value">{metadata.cfg}</span>
          </div>
        )}
      </div>

      {filename && (
        <div className="metadata-filename">{filename}</div>
      )}
    </div>
  );
}
