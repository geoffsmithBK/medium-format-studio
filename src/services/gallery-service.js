import { API_BASE } from '../utils/constants';
import { getImageUrl } from './comfyui-api';
import { extractParametersFromComfyUIWorkflow } from '../utils/png-parser';

/**
 * Fetch recent generations from ComfyUI /history and transform into gallery items.
 * Returns array sorted newest-first.
 */
export async function fetchGalleryItems(limit = 50) {
  const response = await fetch(`${API_BASE}/history`);
  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.status}`);
  }

  const history = await response.json();
  const items = [];

  for (const [promptId, entry] of Object.entries(history)) {
    if (!entry.outputs) continue;

    // Find the highest-numbered output node with images (= highest stage reached)
    const outputNodeIds = Object.keys(entry.outputs)
      .filter((id) => {
        const out = entry.outputs[id];
        return out.images && out.images.length > 0;
      })
      .sort((a, b) => Number(b) - Number(a));

    if (outputNodeIds.length === 0) continue;

    const bestNodeId = outputNodeIds[0];
    const img = entry.outputs[bestNodeId].images[0];

    items.push({
      promptId,
      imageUrl: getImageUrl(img.filename, img.subfolder, img.type),
      filename: img.filename,
      subfolder: img.subfolder,
      timestamp: entry.status?.status_str === 'success'
        ? (entry.status?.completed || 0)
        : 0,
      workflow: entry.prompt?.[2] || null,
    });
  }

  // Sort newest-first by timestamp, then by promptId as fallback
  items.sort((a, b) => b.timestamp - a.timestamp);

  return items.slice(0, limit);
}

/**
 * Extract human-readable metadata from a gallery item's workflow.
 */
export function extractGalleryItemMetadata(item) {
  if (!item.workflow) return null;
  return extractParametersFromComfyUIWorkflow(item.workflow, null, null);
}
