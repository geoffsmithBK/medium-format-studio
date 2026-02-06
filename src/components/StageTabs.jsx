import React from 'react';
import './StageTabs.css';

const TABS = [
  { id: 'contact', label: 'Contact Print' },
  { id: 'work', label: 'Work Print' },
  { id: 'final', label: 'Final Print' },
];

/**
 * Three-tab strip for switching between pipeline output stages.
 */
export default function StageTabs({ activeTab, onTabChange, enabledTabs }) {
  return (
    <div className="stage-tabs" role="tablist">
      {TABS.map((tab) => {
        const isEnabled = enabledTabs.includes(tab.id);
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            className={`stage-tab${isActive ? ' stage-tab-active' : ''}${!isEnabled ? ' stage-tab-disabled' : ''}`}
            onClick={() => isEnabled && onTabChange(tab.id)}
            disabled={!isEnabled}
            aria-selected={isActive}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
