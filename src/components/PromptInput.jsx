import React from 'react';
import CacheWarningDot from './CacheWarningDot';
import './PromptInput.css';

/**
 * Multiline text input for entering image generation prompts
 */
export default function PromptInput({ value, onChange, placeholder, disabled, dirty }) {
  return (
    <div className="prompt-input-container">
      <label htmlFor="prompt" className="prompt-label">
        Prompt<CacheWarningDot dirty={dirty} />
      </label>
      <textarea
        id="prompt"
        className="prompt-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Enter your image description...'}
        disabled={disabled}
        rows={8}
      />
    </div>
  );
}
