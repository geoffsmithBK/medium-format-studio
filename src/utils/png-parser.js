/**
 * PNG Metadata Parser
 * Extracts ComfyUI workflow JSON from PNG file metadata
 */

/**
 * Read a PNG file and extract metadata (ComfyUI workflow or A1111 parameters)
 * @param {File} file - PNG file object
 * @returns {Promise<Object>} Object with metadata and image info
 */
export async function extractWorkflowFromPNG(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const dataView = new DataView(arrayBuffer);

    // Verify PNG signature (first 8 bytes)
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) {
      if (dataView.getUint8(i) !== pngSignature[i]) {
        throw new Error('Not a valid PNG file');
      }
    }

    let workflow = null;
    let parameters = null;
    let imageWidth = null;
    let imageHeight = null;

    // Parse PNG chunks
    let offset = 8; // Skip PNG signature
    while (offset < arrayBuffer.byteLength) {
      // Read chunk length (4 bytes, big-endian)
      const chunkLength = dataView.getUint32(offset);
      offset += 4;

      // Read chunk type (4 bytes, ASCII)
      const chunkType = String.fromCharCode(
        dataView.getUint8(offset),
        dataView.getUint8(offset + 1),
        dataView.getUint8(offset + 2),
        dataView.getUint8(offset + 3)
      );
      offset += 4;

      // Extract image dimensions from IHDR chunk
      if (chunkType === 'IHDR') {
        imageWidth = dataView.getUint32(offset);
        imageHeight = dataView.getUint32(offset + 4);
      }

      // Check if this is a text chunk (tEXt, zTXt, iTXt)
      if (chunkType === 'tEXt' || chunkType === 'iTXt') {
        const chunkData = new Uint8Array(arrayBuffer, offset, chunkLength);
        const text = decodeTextChunk(chunkData, chunkType);

        if (text) {
          // ComfyUI workflow (prompt field)
          if (text.keyword === 'prompt' && !workflow) {
            try {
              workflow = JSON.parse(text.text);
            } catch (e) {
              console.warn('Failed to parse prompt as JSON:', e);
            }
          }
          // Automatic1111/Forge parameters
          else if (text.keyword === 'parameters' && !parameters) {
            parameters = text.text;
          }
        }
      }

      // Skip chunk data and CRC (4 bytes)
      offset += chunkLength + 4;
    }

    return {
      workflow,
      parameters,
      imageWidth,
      imageHeight,
      type: workflow ? 'comfyui' : (parameters ? 'a1111' : 'unknown')
    };
  } catch (error) {
    console.error('Error extracting metadata from PNG:', error);
    return { workflow: null, parameters: null, type: 'unknown' };
  }
}

/**
 * Decode tEXt or iTXt chunk data
 * @param {Uint8Array} data - Chunk data
 * @param {string} chunkType - Chunk type ('tEXt' or 'iTXt')
 * @returns {Object|null} Object with keyword and text, or null
 */
function decodeTextChunk(data, chunkType) {
  try {
    // Find null separator between keyword and text
    let nullIndex = 0;
    while (nullIndex < data.length && data[nullIndex] !== 0) {
      nullIndex++;
    }

    if (nullIndex >= data.length) {
      return null;
    }

    // Extract keyword
    const keyword = new TextDecoder('latin1').decode(data.slice(0, nullIndex));

    // Extract text (after null separator)
    let textStart = nullIndex + 1;

    // For iTXt, skip compression flag, compression method, language tag, and translated keyword
    if (chunkType === 'iTXt') {
      // Skip compression flag (1 byte) and compression method (1 byte)
      textStart += 2;

      // Skip language tag (null-terminated)
      while (textStart < data.length && data[textStart] !== 0) {
        textStart++;
      }
      textStart++; // Skip null

      // Skip translated keyword (null-terminated)
      while (textStart < data.length && data[textStart] !== 0) {
        textStart++;
      }
      textStart++; // Skip null
    }

    const text = new TextDecoder('utf-8').decode(data.slice(textStart));

    return { keyword, text };
  } catch (error) {
    console.error('Error decoding text chunk:', error);
    return null;
  }
}

/**
 * Parse Automatic1111/Forge parameters string
 * @param {string} parametersText - Parameters text from PNG metadata
 * @param {number} imageWidth - Actual image width (fallback)
 * @param {number} imageHeight - Actual image height (fallback)
 * @returns {Object} Parameters object
 */
function parseA1111Parameters(parametersText, imageWidth, imageHeight) {
  const params = {};

  try {
    // Split by "Negative prompt:" to separate positive and negative
    const parts = parametersText.split(/Negative prompt:\s*/i);
    params.prompt = parts[0].trim();

    // Extract settings line (after negative prompt or after positive if no negative)
    let settingsLine = '';
    if (parts.length > 1) {
      const negativeParts = parts[1].split(/\n/);
      params.negativePrompt = negativeParts[0].trim();
      params.negativePromptEnabled = params.negativePrompt.length > 0;
      settingsLine = negativeParts.slice(1).join(' ');
    } else {
      settingsLine = parts[0].split(/\n/).slice(1).join(' ');
      params.prompt = parts[0].split(/\n/)[0].trim();
    }

    // Parse settings (Steps: X, Sampler: Y, CFG scale: Z, Seed: W, Size: WxH, Model: M)
    const stepsMatch = settingsLine.match(/Steps:\s*(\d+)/i);
    if (stepsMatch) params.steps = parseInt(stepsMatch[1]);

    const cfgMatch = settingsLine.match(/CFG scale:\s*([\d.]+)/i);
    if (cfgMatch) params.cfg = parseFloat(cfgMatch[1]);

    const seedMatch = settingsLine.match(/Seed:\s*(\d+)/i);
    if (seedMatch) params.seed = parseInt(seedMatch[1]);

    const sizeMatch = settingsLine.match(/Size:\s*(\d+)x(\d+)/i);
    if (sizeMatch) {
      params.width = parseInt(sizeMatch[1]);
      params.height = parseInt(sizeMatch[2]);
    }

    // Use actual image dimensions as fallback
    if (!params.width && imageWidth) params.width = imageWidth;
    if (!params.height && imageHeight) params.height = imageHeight;

  } catch (error) {
    console.error('Error parsing A1111 parameters:', error);
  }

  return params;
}

/**
 * Extract generation parameters from ComfyUI workflow JSON
 * @param {Object} workflow - Workflow JSON from PNG metadata
 * @param {number} imageWidth - Actual image width (fallback)
 * @param {number} imageHeight - Actual image height (fallback)
 * @returns {Object} Parameters object with prompt, dimensions, seed, etc.
 */
/**
 * Resolve a node reference to get actual text value
 * @param {Object} workflow - Full workflow object
 * @param {*} value - Value that might be a node reference
 * @param {number} depth - Recursion depth limit
 * @returns {string|null} Resolved text or null
 */
function resolveNodeReference(workflow, value, depth = 0) {
  if (depth > 3) return null; // Prevent infinite recursion

  // If it's already a string, return it
  if (typeof value === 'string') return value;

  // If it's a node reference like ["nodeId", 0]
  if (Array.isArray(value) && value.length >= 1) {
    const referencedNodeId = value[0];
    const referencedNode = workflow[referencedNodeId];

    if (!referencedNode || !referencedNode.inputs) return null;

    // Try to get text from common fields
    if (referencedNode.inputs.text) {
      return resolveNodeReference(workflow, referencedNode.inputs.text, depth + 1);
    }
    if (referencedNode.inputs.value) {
      return resolveNodeReference(workflow, referencedNode.inputs.value, depth + 1);
    }
    if (referencedNode.inputs.string) {
      return resolveNodeReference(workflow, referencedNode.inputs.string, depth + 1);
    }
  }

  return null;
}

export function extractParametersFromComfyUIWorkflow(workflow, imageWidth, imageHeight) {
  try {
    const params = {};

    // Validate workflow is an object
    if (!workflow || typeof workflow !== 'object') {
      console.error('Invalid workflow: not an object');
      return params;
    }

    // First pass: collect potential prompt text from various sources
    const promptCandidates = [];

    // Search through all nodes to find parameters
    for (const [nodeId, node] of Object.entries(workflow)) {
      // Skip invalid nodes
      if (!node || typeof node !== 'object' || !node.class_type) continue;

      // Skip nodes without inputs object
      if (node.inputs && typeof node.inputs !== 'object') continue;

      // Extract prompt from various sources
      if (!params.prompt) {
        // Option 1: CLIPTextEncode with title "Positive Prompt" (highest priority)
        if (node.class_type === 'CLIPTextEncode' &&
            node._meta?.title?.includes('Positive Prompt')) {
          const text = resolveNodeReference(workflow, node.inputs?.text, 0);
          if (text && text.length > 50) { // Must be substantial
            promptCandidates.push({ text, priority: 10, source: 'CLIP Positive Prompt' });
          }
        }
        // Option 2: PrimitiveStringMultiline (our web UI format)
        else if (node.class_type === 'PrimitiveStringMultiline' && node.inputs?.value) {
          const text = node.inputs.value;
          // Skip if it looks like a template/style (contains {$ placeholders)
          if (text.length > 50 && !text.includes('{$')) {
            promptCandidates.push({ text, priority: 8, source: 'PrimitiveStringMultiline' });
          }
        }
        // Option 3: CLIPTextEncode with substantial text (not negative)
        else if (node.class_type === 'CLIPTextEncode' &&
                 !node._meta?.title?.includes('Negative') &&
                 node.inputs?.text &&
                 typeof node.inputs.text === 'string') {
          const text = node.inputs.text;
          if (text.length > 50) {
            promptCandidates.push({ text, priority: 7, source: 'CLIPTextEncode' });
          }
        }
      }

      // Extract negative prompt
      if (!params.negativePrompt) {
        // CLIPTextEncode with title "Negative Prompt"
        if (node.class_type === 'CLIPTextEncode' &&
            node._meta?.title?.includes('Negative Prompt') &&
            node.inputs?.text) {
          params.negativePrompt = node.inputs.text;
          params.negativePromptEnabled = params.negativePrompt.trim().length > 0;
        }
      }

      // Extract dimensions from various sources
      if (!params.width || !params.height) {
        // Option 1: PrimitiveInt nodes (our web UI format)
        if (node.class_type === 'PrimitiveInt') {
          if (node._meta?.title === 'Width' && node.inputs?.value) {
            params.width = node.inputs.value;
          } else if (node._meta?.title === 'Height' && node.inputs?.value) {
            params.height = node.inputs.value;
          }
        }
        // Option 2: EmptyFlux2LatentImage with direct width/height
        else if (node.class_type === 'EmptyFlux2LatentImage' && node.inputs) {
          if (node.inputs.width && !params.width) params.width = node.inputs.width;
          if (node.inputs.height && !params.height) params.height = node.inputs.height;
        }
        // Option 3: EmptyLatentImage (SDXL, SD 1.5)
        else if (node.class_type === 'EmptyLatentImage' && node.inputs) {
          if (node.inputs.width && !params.width) params.width = node.inputs.width;
          if (node.inputs.height && !params.height) params.height = node.inputs.height;
        }
        // Option 4: Flux2Scheduler with width/height (as numbers, not references)
        else if (node.class_type === 'Flux2Scheduler' && node.inputs) {
          if (typeof node.inputs.width === 'number' && !params.width) {
            params.width = node.inputs.width;
          }
          if (typeof node.inputs.height === 'number' && !params.height) {
            params.height = node.inputs.height;
          }
        }
      }

      // Extract seed from various sources
      if (!params.seed) {
        // RandomNoise (Flux)
        if (node.class_type === 'RandomNoise' && node.inputs?.noise_seed !== undefined) {
          // Handle both direct values and node references
          const seedValue = node.inputs.noise_seed;
          if (typeof seedValue === 'number') {
            params.seed = seedValue;
          } else if (Array.isArray(seedValue)) {
            // Seed comes from another node - try to resolve it
            const refNode = workflow[seedValue[0]];
            if (refNode?.inputs?.seed !== undefined) {
              params.seed = refNode.inputs.seed;
            }
          }
        }
        // KSamplerAdvanced or KSampler (SDXL, SD 1.5)
        else if ((node.class_type === 'KSamplerAdvanced' || node.class_type === 'KSampler') &&
                 node.inputs?.noise_seed !== undefined) {
          params.seed = node.inputs.noise_seed;
        }
        else if ((node.class_type === 'KSamplerAdvanced' || node.class_type === 'KSampler') &&
                 node.inputs?.seed !== undefined) {
          params.seed = node.inputs.seed;
        }
      }

      // Extract model
      if (!params.model) {
        // UNETLoader (Flux)
        if (node.class_type === 'UNETLoader' && node.inputs?.unet_name) {
          params.model = node.inputs.unet_name;
        }
        // CheckpointLoaderSimple (SDXL, SD 1.5)
        else if (node.class_type === 'CheckpointLoaderSimple' && node.inputs?.ckpt_name) {
          params.model = node.inputs.ckpt_name;
        }
      }

      // Extract steps
      if (!params.steps) {
        // Flux2Scheduler
        if (node.class_type === 'Flux2Scheduler' && node.inputs?.steps !== undefined) {
          params.steps = node.inputs.steps;
        }
        // KSamplerAdvanced or KSampler
        else if ((node.class_type === 'KSamplerAdvanced' || node.class_type === 'KSampler') &&
                 node.inputs?.steps !== undefined) {
          params.steps = node.inputs.steps;
        }
      }

      // Extract CFG
      if (!params.cfg) {
        // CFGGuider (Flux)
        if (node.class_type === 'CFGGuider' && node.inputs?.cfg !== undefined) {
          params.cfg = node.inputs.cfg;
        }
        // KSamplerAdvanced or KSampler
        else if ((node.class_type === 'KSamplerAdvanced' || node.class_type === 'KSampler') &&
                 node.inputs?.cfg !== undefined) {
          params.cfg = node.inputs.cfg;
        }
      }
    }

    // After loop: select best prompt candidate
    if (!params.prompt && promptCandidates.length > 0) {
      // Sort by priority (highest first)
      promptCandidates.sort((a, b) => b.priority - a.priority);
      params.prompt = promptCandidates[0].text;
      console.log('Selected prompt from:', promptCandidates[0].source);
    }

    // Use actual image dimensions as fallback if not found or if they're significantly different
    // (workflow dimensions might be from before upscaling)
    const hasValidWorkflowDimensions =
      params.width && params.height &&
      typeof params.width === 'number' && typeof params.height === 'number' &&
      !isNaN(params.width) && !isNaN(params.height);

    const hasValidImageDimensions =
      imageWidth && imageHeight &&
      typeof imageWidth === 'number' && typeof imageHeight === 'number' &&
      !isNaN(imageWidth) && !isNaN(imageHeight);

    if (!hasValidWorkflowDimensions && hasValidImageDimensions) {
      // No valid workflow dimensions, use image dimensions
      console.log('Using actual image dimensions:', imageWidth, 'x', imageHeight);
      params.width = imageWidth;
      params.height = imageHeight;
    } else if (hasValidWorkflowDimensions && hasValidImageDimensions) {
      // Both are valid, check if they differ significantly
      const widthDiff = Math.abs(params.width - imageWidth);
      const heightDiff = Math.abs(params.height - imageHeight);

      if (widthDiff > 100 || heightDiff > 100) {
        console.log('Image dimensions differ from workflow. Using actual:', imageWidth, 'x', imageHeight,
                    '(workflow had:', params.width, 'x', params.height, ')');
        params.width = imageWidth;
        params.height = imageHeight;
      }
    }

    return params;
  } catch (error) {
    console.error('Error extracting parameters from ComfyUI workflow:', error);
    console.error('Stack trace:', error.stack);
    return {};
  }
}

/**
 * Main function to extract parameters from PNG metadata
 * Handles both ComfyUI and Automatic1111/Forge formats
 * @param {Object} metadata - Metadata object from extractWorkflowFromPNG
 * @returns {Object} Parameters object with extracted info and warnings
 */
export function extractParametersFromMetadata(metadata) {
  try {
    const { workflow, parameters, imageWidth, imageHeight, type } = metadata;

    let params = {};
    const warnings = [];

    if (type === 'comfyui' && workflow) {
      try {
        params = extractParametersFromComfyUIWorkflow(workflow, imageWidth, imageHeight);
        console.log('Extracted from ComfyUI workflow:', params);
      } catch (err) {
        console.error('Error parsing ComfyUI workflow:', err);
        warnings.push('Error parsing ComfyUI workflow');
        // Still provide image dimensions as fallback
        if (imageWidth && imageHeight) {
          params.width = imageWidth;
          params.height = imageHeight;
        }
      }
    } else if (type === 'a1111' && parameters) {
      try {
        params = parseA1111Parameters(parameters, imageWidth, imageHeight);
        console.log('Extracted from A1111/Forge parameters:', params);
      } catch (err) {
        console.error('Error parsing A1111 parameters:', err);
        warnings.push('Error parsing A1111/Forge parameters');
        // Still provide image dimensions as fallback
        if (imageWidth && imageHeight) {
          params.width = imageWidth;
          params.height = imageHeight;
        }
      }
    } else {
      warnings.push('No recognized metadata format found');
      // Still provide image dimensions as fallback
      if (imageWidth && imageHeight) {
        params.width = imageWidth;
        params.height = imageHeight;
        warnings.push('Using image dimensions only');
      }
    }

    // Track what we successfully extracted
    const extracted = [];
    const missing = [];

    if (params.prompt) extracted.push('prompt');
    else missing.push('prompt');

    if (params.width && params.height) extracted.push('dimensions');
    else missing.push('dimensions');

    if (params.seed) extracted.push('seed');
    else missing.push('seed');

    if (params.steps) extracted.push('steps');
    else missing.push('steps');

    if (params.cfg) extracted.push('CFG');
    else missing.push('CFG');

    if (params.model) extracted.push('model');
    else missing.push('model');

    if (params.negativePrompt) extracted.push('negative prompt');

    // Build user-friendly message
    let message = '';
    if (extracted.length > 0) {
      message = `Loaded: ${extracted.join(', ')}`;
      if (missing.length > 0) {
        message += `. Could not find: ${missing.join(', ')}`;
      }
    } else {
      message = 'Could not extract generation parameters from this image';
    }

    return {
      ...params,
      _metadata: {
        type: metadata.type,
        extracted,
        missing,
        warnings,
        message
      }
    };
  } catch (error) {
    console.error('Fatal error in extractParametersFromMetadata:', error);
    console.error('Stack trace:', error.stack);

    // Return minimal safe object to prevent app crash
    return {
      _metadata: {
        type: 'unknown',
        extracted: [],
        missing: ['all'],
        warnings: ['Fatal error parsing metadata'],
        message: 'Error reading image metadata. Please check browser console for details.'
      }
    };
  }
}
