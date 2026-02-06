import React from 'react';
import './StageTabs.css';

const DEFAULT_TABS = [
  { id: 'contact', label: 'Contact Print' },
  { id: 'work', label: 'Work Print' },
  { id: 'final', label: 'Final Print' },
];

/**
 * Tab strip for switching between pipeline output stages.
 * Accepts an optional `tabs` prop to override the default 3-tab layout.
 */
export default function StageTabs({ tabs = DEFAULT_TABS, activeTab, onTabChange, enabledTabs }) {
  return (
    <div className="stage-tabs" role="tablist">
      {tabs.map((tab) => {
        const isEnabled = enabledTabs.includes(tab.id);
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            className={`stage-tab${isActive ? ' stage-tab-active' : ''}${!isEnabled ? ' stage-tab-disabled' : ''}${tab.className ? ` ${tab.className}` : ''}`}
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
