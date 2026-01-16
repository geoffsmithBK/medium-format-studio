import React from 'react';
import './NegativePromptInput.css';

/**
 * Optional negative prompt input with checkbox toggle
 */
export default function NegativePromptInput({
  enabled,
  value,
  onEnabledChange,
  onChange,
  disabled
}) {
  return (
    <div className="negative-prompt-container">
      <div className="negative-prompt-header">
        <input
          type="checkbox"
          id="negative-prompt-enabled"
          className="negative-prompt-checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          disabled={disabled}
        />
        <label htmlFor="negative-prompt-enabled" className="negative-prompt-label">
          Use Negative Prompt
        </label>
      </div>

      {enabled && (
        <textarea
          id="negative-prompt"
          className="negative-prompt-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Things to avoid in the image..."
          disabled={disabled}
          rows={2}
        />
      )}
    </div>
  );
}
