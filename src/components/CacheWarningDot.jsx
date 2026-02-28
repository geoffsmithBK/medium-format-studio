import React from 'react';
import Tooltip from './Tooltip';
import './CacheWarningDot.css';

/**
 * Tiny orange dot indicating a cache-breaking parameter changed since last generation.
 * Renders nothing when dirty is false.
 */
export default function CacheWarningDot({ dirty }) {
  if (!dirty) return null;

  return (
    <Tooltip text="This parameter changed since last generation. Promoting will use cached earlier stages with the old value — use New Exposure to regenerate from scratch.">
      <span className="cache-warning-dot" />
    </Tooltip>
  );
}
