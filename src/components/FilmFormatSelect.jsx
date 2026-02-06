import React from 'react';
import './FilmFormatSelect.css';

/**
 * Dropdown selector for medium-format film format presets.
 */
export default function FilmFormatSelect({ value, onChange, formats, disabled }) {
  return (
    <div className="film-format-container">
      <label htmlFor="film-format" className="film-format-label">
        Film Format
      </label>
      <select
        id="film-format"
        className="film-format-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {formats.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}
