import React, { useState, useEffect, useRef } from 'react';
import { getServerUrl, setServerUrl } from '../utils/constants';
import { checkServerStatus } from '../services/comfyui-api';
import './ServerSettings.css';

export default function ServerSettings() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(getServerUrl);
  const [status, setStatus] = useState('unknown'); // unknown | checking | connected | error
  const panelRef = useRef(null);

  // Check connection on mount and when URL changes
  useEffect(() => {
    checkConnection();
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function checkConnection() {
    setStatus('checking');
    const ok = await checkServerStatus();
    setStatus(ok ? 'connected' : 'error');
  }

  function handleSave() {
    const trimmed = url.trim().replace(/\/+$/, '');
    setUrl(trimmed);
    setServerUrl(trimmed);
    setStatus('unknown');
    // Check new connection
    setTimeout(checkConnection, 100);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave();
  }

  const statusColors = {
    unknown: '#606060',
    checking: '#b0b000',
    connected: '#00aa44',
    error: '#cc3333',
  };

  return (
    <div className="server-settings" ref={panelRef}>
      <button
        type="button"
        className="server-settings-btn"
        onClick={() => setOpen(!open)}
        title="Server connection settings"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span
          className="server-settings-dot"
          style={{ background: statusColors[status] }}
        />
      </button>

      {open && (
        <div className="server-settings-panel">
          <div className="server-settings-header">ComfyUI Server</div>
          <div className="server-settings-row">
            <input
              type="text"
              className="server-settings-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="http://127.0.0.1:8188"
              spellCheck={false}
            />
            <button
              type="button"
              className="server-settings-save"
              onClick={handleSave}
            >
              Connect
            </button>
          </div>
          <div className="server-settings-status">
            <span
              className="server-settings-status-dot"
              style={{ background: statusColors[status] }}
            />
            {status === 'checking' && 'Connecting...'}
            {status === 'connected' && `Connected to ${getServerUrl()}`}
            {status === 'error' && 'Connection failed'}
            {status === 'unknown' && 'Not checked'}
          </div>
        </div>
      )}
    </div>
  );
}
