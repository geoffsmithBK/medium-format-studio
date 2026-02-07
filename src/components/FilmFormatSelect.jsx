import React from 'react';
import './FilmFormatSelect.css';

/**
 * Parse WxH from a format value string like "6x7 - 1120x928".
 */
function parseDims(value) {
  const m = value.match(/(\d+)x(\d+)$/);
  return m ? { w: parseInt(m[1], 10), h: parseInt(m[2], 10) } : null;
}

/**
 * Dropdown selector for medium-format film format presets,
 * with Portrait toggle and pixel dimension display.
 */
export default function FilmFormatSelect({ value, onChange, formats, portrait, onPortraitChange, filmBorders, onFilmBordersChange, bw, onBwChange, disabled }) {
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
        {formats.map((f) => {
          const d = parseDims(f.value);
          const dimStr = d ? ` (${d.w}x${d.h})` : '';
          return (
            <option key={f.value} value={f.value}>
              {f.label}{dimStr}
            </option>
          );
        })}
      </select>
      <div className="film-format-options">
        <label className="film-format-checkbox-label">
          <input
            type="checkbox"
            className="film-format-checkbox"
            checked={portrait}
            onChange={(e) => onPortraitChange(e.target.checked)}
            disabled={disabled}
          />
          Portrait
        </label>
        <label className="film-format-checkbox-label">
          <input
            type="checkbox"
            className="film-format-checkbox"
            checked={filmBorders}
            onChange={(e) => onFilmBordersChange(e.target.checked)}
            disabled={disabled}
          />
          Film Borders
        </label>
        <label className="film-format-checkbox-label">
          <input
            type="checkbox"
            className="film-format-checkbox"
            checked={bw}
            onChange={(e) => onBwChange(e.target.checked)}
            disabled={disabled}
          />
          B&amp;W
        </label>
      </div>
    </div>
  );
}
