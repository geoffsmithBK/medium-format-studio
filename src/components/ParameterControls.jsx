import React from 'react';
import { MODELS, DEFAULT_WIDTH, DEFAULT_HEIGHT } from '../utils/constants';
import { generateRandomSeed } from '../services/workflow-loader';
import './ParameterControls.css';

/**
 * Control panel for workflow parameters (dimensions, seed, model, steps, cfg)
 */
export default function ParameterControls({
  width,
  height,
  seed,
  model,
  steps,
  cfg,
  onWidthChange,
  onHeightChange,
  onSeedChange,
  onModelChange,
  onStepsChange,
  onCfgChange,
  disabled,
}) {
  const handleRandomizeSeed = () => {
    onSeedChange(generateRandomSeed());
  };

  return (
    <div className="parameter-controls">
      <div className="parameter-section">
        <h3 className="parameter-section-title">Image Dimensions</h3>

        <div className="parameter-row">
          <div className="parameter-field">
            <label htmlFor="width" className="parameter-label">
              Width
            </label>
            <input
              id="width"
              type="number"
              className="parameter-input"
              value={width}
              onChange={(e) => onWidthChange(parseInt(e.target.value) || DEFAULT_WIDTH)}
              min="256"
              max="2048"
              step="64"
              disabled={disabled}
            />
          </div>

          <div className="parameter-field">
            <label htmlFor="height" className="parameter-label">
              Height
            </label>
            <input
              id="height"
              type="number"
              className="parameter-input"
              value={height}
              onChange={(e) => onHeightChange(parseInt(e.target.value) || DEFAULT_HEIGHT)}
              min="256"
              max="2048"
              step="64"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <div className="parameter-section">
        <h3 className="parameter-section-title">Seed</h3>
        <div className="parameter-row">
          <div className="parameter-field parameter-field-grow">
            <input
              type="number"
              className="parameter-input"
              value={seed}
              onChange={(e) => onSeedChange(parseInt(e.target.value) || 0)}
              min="0"
              disabled={disabled}
            />
          </div>
          <button
            className="parameter-button"
            onClick={handleRandomizeSeed}
            disabled={disabled}
            type="button"
          >
            Randomize
          </button>
        </div>
      </div>

      <div className="parameter-section">
        <h3 className="parameter-section-title">Model</h3>
        <select
          className="parameter-select"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={disabled}
        >
          <option value={MODELS.DISTILLED}>Flux 2 Klein 4B Distilled (Fast)</option>
          <option value={MODELS.BASE}>Flux 2 Klein 4B Base (Quality)</option>
        </select>
      </div>

      <div className="parameter-section">
        <h3 className="parameter-section-title">Generation Parameters</h3>

        <div className="parameter-row">
          <div className="parameter-field">
            <label htmlFor="steps" className="parameter-label">
              Steps
            </label>
            <input
              id="steps"
              type="number"
              className="parameter-input"
              value={steps}
              onChange={(e) => onStepsChange(parseInt(e.target.value) || 1)}
              min="1"
              max="100"
              step="1"
              disabled={disabled}
            />
          </div>

          <div className="parameter-field">
            <label htmlFor="cfg" className="parameter-label">
              CFG Scale
            </label>
            <input
              id="cfg"
              type="number"
              className="parameter-input"
              value={Number(cfg).toFixed(1)}
              onChange={(e) => onCfgChange(parseFloat(e.target.value) || 1.0)}
              min="0"
              max="30"
              step="0.1"
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
