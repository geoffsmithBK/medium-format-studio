import React from 'react';
import './LoRAControls.css';

/**
 * Two-row LoRA control: checkbox toggle + label + strength input with range enforcement.
 */
export default function LoRAControls({
  lora1Enabled, lora1Strength, lora1Name, lora1Min, lora1Max, lora1Step,
  lora2Enabled, lora2Strength, lora2Name, lora2Min, lora2Max, lora2Step,
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
        min={lora1Min}
        max={lora1Max}
        step={lora1Step}
        onEnabledChange={onLora1EnabledChange}
        onStrengthChange={onLora1StrengthChange}
        disabled={disabled}
      />
      <LoRARow
        id="lora2"
        label={lora2Name}
        enabled={lora2Enabled}
        strength={lora2Strength}
        min={lora2Min}
        max={lora2Max}
        step={lora2Step}
        onEnabledChange={onLora2EnabledChange}
        onStrengthChange={onLora2StrengthChange}
        disabled={disabled}
      />
    </div>
  );
}

function LoRARow({ id, label, enabled, strength, min = 0, max = 10, step = 0.1, onEnabledChange, onStrengthChange, disabled }) {
  const rangeLabel = `(${min}–${max})`;

  function handleChange(e) {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) val = min;
    val = Math.min(max, Math.max(min, val));
    onStrengthChange(val);
  }

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
      <label htmlFor={id} className="lora-label">
        {label} <span className="lora-range">{rangeLabel}</span>
      </label>
      <input
        type="number"
        className="lora-strength"
        value={strength}
        onChange={handleChange}
        step={step}
        min={min}
        max={max}
        disabled={disabled || !enabled}
        title={`Strength ${rangeLabel}`}
      />
    </div>
  );
}
