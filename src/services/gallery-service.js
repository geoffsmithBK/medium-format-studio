import { getApiBase } from '../utils/constants';
import { getImageUrl } from './comfyui-api';
import { extractParametersFromComfyUIWorkflow, extractWorkflowFromPNG } from '../utils/png-parser';

/**
 * Fetch recent generations from ComfyUI /history and transform into gallery items.
 * Returns array sorted newest-first.
 */
export async function fetchGalleryItems(limit = 50) {
  const response = await fetch(`${getApiBase()}/history`);
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

const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|webp)$/i;
const MAX_FOLDER_ITEMS = 200;

/**
 * Load images from a folder FileList (from <input webkitdirectory>).
 * Creates blob: URLs for display and extracts PNG metadata when available.
 */
export async function loadFolderItems(fileList) {
  const imageFiles = Array.from(fileList).filter((f) => IMAGE_EXTENSIONS.test(f.name));

  imageFiles.sort((a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name));

  const truncated = imageFiles.length > MAX_FOLDER_ITEMS;
  const filesToLoad = imageFiles.slice(-MAX_FOLDER_ITEMS);

  const items = await Promise.all(
    filesToLoad.map(async (file) => {
      const imageUrl = URL.createObjectURL(file);
      let workflow = null;

      if (/\.png$/i.test(file.name)) {
        try {
          const result = await extractWorkflowFromPNG(file);
          workflow = result.workflow || null;
        } catch (e) {
          console.warn('PNG metadata extraction failed for', file.name, e);
        }
      }

      return {
        promptId: `folder-${file.name}-${file.lastModified}`,
        imageUrl,
        filename: file.name,
        subfolder: '',
        timestamp: file.lastModified,
        workflow,
      };
    })
  );

  return { items, totalCount: imageFiles.length, truncated };
}

/**
 * Extract human-readable metadata from a gallery item's workflow.
 */
export function extractGalleryItemMetadata(item) {
  if (!item.workflow) return null;
  return extractParametersFromComfyUIWorkflow(item.workflow, null, null);
}
