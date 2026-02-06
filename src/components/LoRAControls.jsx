import React from 'react';
import './LoRAControls.css';

/**
 * Two-row LoRA control: checkbox toggle + label + strength input.
 */
export default function LoRAControls({
  lora1Enabled, lora1Strength, lora1Name,
  lora2Enabled, lora2Strength, lora2Name,
  onLora1EnabledChange, onLora1StrengthChange,
  onLora2EnabledChange, onLora2StrengthChange,
  disabled,
}) {
  return (
    <div className="lora-controls">
      <LoRARow
        id="lora1"
        label={lora1Name}
        enabled={lora1Enabled}
        strength={lora1Strength}
        onEnabledChange={onLora1EnabledChange}
        onStrengthChange={onLora1StrengthChange}
        disabled={disabled}
      />
      <LoRARow
        id="lora2"
        label={lora2Name}
        enabled={lora2Enabled}
        strength={lora2Strength}
        onEnabledChange={onLora2EnabledChange}
        onStrengthChange={onLora2StrengthChange}
        disabled={disabled}
      />
    </div>
  );
}

function LoRARow({ id, label, enabled, strength, onEnabledChange, onStrengthChange, disabled }) {
  return (
    <div className="lora-row">
      <input
        type="checkbox"
        id={id}
        className="lora-checkbox"
        checked={enabled}
        onChange={(e) => onEnabledChange(e.target.checked)}
        disabled={disabled}
      />
      <label htmlFor={id} className="lora-label">{label}</label>
      <input
        type="number"
        className="lora-strength"
        value={strength}
        onChange={(e) => onStrengthChange(parseFloat(e.target.value) || 0)}
        step={0.1}
        disabled={disabled || !enabled}
        title="Strength"
      />
    </div>
  );
}
