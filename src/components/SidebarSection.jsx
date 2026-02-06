import React, { useState } from 'react';
import './SidebarSection.css';

/**
 * Collapsible sidebar section with stage number badge.
 */
export default function SidebarSection({
  stageNumber,
  title,
  defaultOpen = false,
  disabled = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`sidebar-section${disabled ? ' sidebar-section-disabled' : ''}`}>
      <button
        type="button"
        className="sidebar-section-header"
        onClick={() => !disabled && setOpen(!open)}
        aria-expanded={open}
        disabled={disabled}
      >
        <span className="sidebar-section-chevron">{open ? '▾' : '▸'}</span>
        <span className="sidebar-section-badge">{stageNumber}</span>
        <span className="sidebar-section-title">{title}</span>
      </button>
      {open && !disabled && (
        <div className="sidebar-section-body">{children}</div>
      )}
    </div>
  );
}
