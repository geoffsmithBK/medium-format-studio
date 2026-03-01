import React from 'react';
import CacheWarningDot from './CacheWarningDot';
import './PromptInput.css';

/**
 * Multiline text input for entering image generation prompts
 */
export default function PromptInput({ value, onChange, placeholder, disabled, dirty, id = 'prompt', label = 'Prompt', rows = 8 }) {
  return (
    <div className="prompt-input-container">
      <label htmlFor={id} className="prompt-label">
        {label}<CacheWarningDot dirty={dirty} />
      </label>
      <textarea
        id={id}
        className="prompt-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Enter your image description...'}
        disabled={disabled}
        rows={rows}
      />
    </div>
  );
}
