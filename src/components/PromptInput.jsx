import React from 'react';
import CacheWarningDot from './CacheWarningDot';
import Tooltip from './Tooltip';
import './PromptInput.css';

/**
 * Multiline text input for entering image generation prompts
 */
export default function PromptInput({ value, onChange, placeholder, disabled, dirty, id = 'prompt', label = 'Prompt', rows = 8, tooltipId, defaultText }) {
  const handleFocus = (e) => {
    if (defaultText && !value) {
      // Insert via execCommand so the browser's undo stack tracks it (Cmd+Z reverts to empty)
      document.execCommand('insertText', false, defaultText);
    }
  };

  return (
    <div className="prompt-input-container">
      <label htmlFor={id} className="prompt-label">
        {tooltipId ? <Tooltip tooltipId={tooltipId}><strong>{label}</strong></Tooltip> : label}
        <CacheWarningDot dirty={dirty} />
      </label>
      <textarea
        id={id}
        className="prompt-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        placeholder={placeholder || 'Enter your image description...'}
        disabled={disabled}
        rows={rows}
      />
    </div>
  );
}
