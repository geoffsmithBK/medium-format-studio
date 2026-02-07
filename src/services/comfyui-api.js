import { getApiBase, getWsBase } from '../utils/constants';

/**
 * Generate a unique client ID for WebSocket connection
 */
export function generateClientId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Queue a workflow for execution
 * @param {Object} workflow - The complete workflow JSON
 * @param {string} clientId - Unique client identifier
 * @returns {Promise<Object>} Response with prompt_id, number, and node_errors
 */
export async function queuePrompt(workflow, clientId) {
  try {
    const response = await fetch(`${getApiBase()}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: workflow,
        client_id: clientId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error queuing prompt:', error);
    throw new Error(`Failed to queue prompt: ${error.message}`);
  }
}

/**
 * Get execution history for a specific prompt
 * @param {string} promptId - The prompt ID to fetch history for
 * @returns {Promise<Object>} Execution history with output information
 */
export async function getHistory(promptId) {
  try {
    const response = await fetch(`${getApiBase()}/history/${promptId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching history:', error);
    throw new Error(`Failed to fetch history: ${error.message}`);
  }
}

/**
 * Construct URL for viewing an image
 * @param {string} filename - Image filename
 * @param {string} subfolder - Subfolder path
 * @param {string} type - Image type (usually 'output')
 * @returns {string} Full URL to the image
 */
export function getImageUrl(filename, subfolder, type = 'output') {
  const params = new URLSearchParams({
    filename,
    type,
  });

  if (subfolder) {
    params.append('subfolder', subfolder);
  }

  return `${getApiBase()}/view?${params.toString()}`;
}

/**
 * Connect to ComfyUI WebSocket for real-time progress updates
 * @param {string} clientId - Unique client identifier
 * @param {Object} callbacks - Event callbacks
 * @param {Function} callbacks.onProgress - Called with progress updates (value, max)
 * @param {Function} callbacks.onExecuting - Called when execution starts/changes node
 * @param {Function} callbacks.onExecuted - Called when a node completes execution
 * @param {Function} callbacks.onError - Called on WebSocket errors
 * @param {Function} callbacks.onClose - Called when WebSocket closes
 * @returns {WebSocket} WebSocket instance (call .close() to disconnect)
 */
export function connectWebSocket(clientId, callbacks = {}) {
  const ws = new WebSocket(`${getWsBase()}/ws?clientId=${clientId}`);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      const { type, data } = message;

      console.log('WebSocket message:', type, data);

      switch (type) {
        case 'progress':
          if (callbacks.onProgress) {
            callbacks.onProgress(data.value, data.max);
          }
          break;

        case 'executing':
          if (callbacks.onExecuting) {
            callbacks.onExecuting(data.node, data.prompt_id);
          }
          break;

        case 'executed':
          if (callbacks.onExecuted) {
            callbacks.onExecuted(data);
          }
          break;

        case 'execution_cached':
          console.log('Execution cached:', data);
          if (callbacks.onCached) {
            callbacks.onCached(data);
          }
          break;

        case 'status':
          console.log('Status update:', data);
          break;

        default:
          console.log('Unknown message type:', type, data);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error, event.data);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (callbacks.onError) {
      callbacks.onError(error);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket closed');
    if (callbacks.onClose) {
      callbacks.onClose();
    }
  };

  return ws;
}

/**
 * Fetch available LoRA filenames from ComfyUI via /object_info/LoraLoader.
 * @returns {Promise<string[]>} Array of LoRA filenames available on the server
 */
export async function getAvailableLoRAs() {
  const response = await fetch(`${getApiBase()}/object_info/LoraLoader`);
  if (!response.ok) {
    throw new Error(`Failed to fetch LoRA list: ${response.status}`);
  }
  const data = await response.json();
  return data.LoraLoader.input.required.lora_name[0];
}

/**
 * Check if ComfyUI server is running
 * @returns {Promise<boolean>} True if server is accessible
 */
export async function checkServerStatus() {
  try {
    const response = await fetch(`${getApiBase()}/system_stats`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}
